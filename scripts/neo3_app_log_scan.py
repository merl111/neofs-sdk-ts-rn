#!/usr/bin/env python3
"""
Scan Neo N3 blocks and persist ApplicationLog notifications incrementally.

Outputs are written after every processed transaction (i.e. after each
getapplicationlog call), so long scans can be resumed and won't lose progress.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import logging
import random
import sys
import time
from collections import Counter
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.error import URLError
import urllib.error
from urllib.request import Request, urlopen


LOG = logging.getLogger("neo3_app_log_scan")


class RpcError(RuntimeError):
    pass


def _utc_now_compact() -> str:
    return (
        _dt.datetime.now(_dt.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace(":", "")
        .replace("-", "")
        .replace("+0000", "Z")
        .replace("+00:00", "Z")
    )


def _utc_iso_z() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat().replace("+00:00", "Z")


def rpc_call(
    rpc_url: str,
    method: str,
    params: Optional[list] = None,
    *,
    timeout_s: float = 15.0,
    retries: int = 3,
    backoff_base_s: float = 0.15,
) -> Any:
    if params is None:
        params = []
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    data = json.dumps(payload).encode("utf-8")

    last_exc: Optional[BaseException] = None
    for i in range(retries):
        try:
            req = Request(rpc_url, data=data, headers={"Content-Type": "application/json"})
            with urlopen(req, timeout=timeout_s) as r:
                resp = json.loads(r.read().decode("utf-8"))
            if "error" in resp:
                raise RpcError(str(resp["error"]))
            return resp["result"]
        except (RpcError, URLError, TimeoutError, OSError, ValueError) as e:
            last_exc = e
            sleep_s = backoff_base_s * (2**i) + random.random() * 0.05
            time.sleep(sleep_s)
    raise last_exc or RuntimeError("RPC failed")


def stack_item_to_json(si: Any) -> Any:
    """
    Keep Neo VM stack item as JSON-friendly structure.
    (We do not attempt to decode ByteString; we keep raw `value` as returned.)
    """
    if si is None:
        return None
    if not isinstance(si, dict):
        return si
    t = si.get("type")
    if t in (
        "Integer",
        "Boolean",
        "ByteString",
        "String",
        "Hash160",
        "Hash256",
        "PublicKey",
        "Signature",
        "InteropInterface",
    ):
        return {"type": t, "value": si.get("value")}
    if t == "Any":
        return None
    if t == "Array":
        return [stack_item_to_json(x) for x in (si.get("value") or [])]
    if t == "Map":
        return [
            (stack_item_to_json(kv.get("key")), stack_item_to_json(kv.get("value")))
            for kv in (si.get("value") or [])
        ]
    return {"type": t, "value": si.get("value")}


@dataclass(frozen=True)
class ScanConfig:
    rpc_urls: List[str]
    last_n_blocks: int
    out_dir: Path
    timeout_s: float
    retries: int
    progress_every_blocks: int
    max_notifications_samples_per_pair: int
    resume: bool
    workers: int
    exclude_eventnames: List[str]
    summary_every_txs: int
    max_tx_attempts: int


def _read_json(path: Path) -> Optional[dict]:
    try:
        return json.loads(path.read_text("utf-8"))
    except FileNotFoundError:
        return None
    except Exception:
        LOG.exception("Failed reading JSON: %s", path)
        return None


def _write_json_atomic(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", "utf-8")
    tmp.replace(path)


def _write_json_atomic_compact(path: Path, obj: Any) -> None:
    """
    Fast variant for very frequent writes (progress after every tx).
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n", "utf-8")
    tmp.replace(path)


def _append_ndjson(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")
        f.flush()


def _normalize_contract(contract: Optional[str]) -> str:
    return (contract or "").lower()


def _parse_rpc_list(rpcs: str) -> List[str]:
    parts = [p.strip() for p in rpcs.replace("\n", ",").replace("\t", ",").split(",")]
    out = [p for p in parts if p]
    seen = set()
    uniq: List[str] = []
    for u in out:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def _default_rpc_list() -> List[str]:
    return [f"https://rpc{i}.morph.t5.fs.neo.org:51331" for i in range(1, 8)]


def _round_robin(items: Sequence[str]) -> Iterable[str]:
    if not items:
        return iter(())
    i = 0
    while True:
        yield items[i % len(items)]
        i += 1


def _fetch_applicationlog_for_tx(
    rpc_url: str,
    txid: str,
    *,
    timeout_s: float,
    retries: int,
) -> dict:
    al = rpc_call(rpc_url, "getapplicationlog", [txid], timeout_s=timeout_s, retries=retries)
    return {"rpc_url": rpc_url, "txid": txid, "applicationlog": al}


def _is_connection_refused(e: BaseException) -> bool:
    # Typical: URLError(ConnectionRefusedError(111, 'Connection refused'))
    if isinstance(e, urllib.error.URLError):
        reason = getattr(e, "reason", None)
        if isinstance(reason, ConnectionRefusedError):
            return True
        if isinstance(reason, OSError) and getattr(reason, "errno", None) == 111:
            return True
    return False


def _rpc_healthcheck(rpc_url: str, timeout_s: float) -> bool:
    try:
        rpc_call(rpc_url, "getversion", timeout_s=max(3.0, timeout_s), retries=1, backoff_base_s=0.05)
        return True
    except Exception:
        return False


class RpcPool:
    """
    Minimal RPC selector with cooldown for unhealthy endpoints.
    Selection is done from the main thread only (no locking needed).
    """

    def __init__(self, rpc_urls: Sequence[str], *, cooldown_s: float = 30.0):
        self._all = list(rpc_urls)
        self._cooldown_s = float(cooldown_s)
        self._unhealthy_until: Dict[str, float] = {}
        self._rr = _round_robin(self._all)

    def mark_unhealthy(self, rpc_url: str) -> None:
        self._unhealthy_until[rpc_url] = time.time() + self._cooldown_s

    def healthy_urls(self) -> List[str]:
        now = time.time()
        return [u for u in self._all if self._unhealthy_until.get(u, 0.0) <= now]

    def pick(self) -> str:
        healthy = set(self.healthy_urls())
        if not healthy:
            # fallback: try anything; caller will mark unhealthy again on failure
            return next(self._rr)
        # find next healthy in rr
        for _ in range(len(self._all) * 2):
            u = next(self._rr)
            if u in healthy:
                return u
        # should not happen, but fallback
        return next(iter(healthy))


def scan(config: ScanConfig) -> None:
    config.out_dir.mkdir(parents=True, exist_ok=True)

    run_meta_path = config.out_dir / "run.json"
    progress_path = config.out_dir / "progress.json"
    summary_path = config.out_dir / "summary.json"
    notifications_path = config.out_dir / "notifications.ndjson"
    errors_path = config.out_dir / "errors.ndjson"

    # Load or initialize progress
    progress = _read_json(progress_path) if config.resume else None

    if not config.rpc_urls:
        raise ValueError("No RPC URLs provided")

    # Health-check and drop dead RPCs early to avoid spamming errors.
    alive = [u for u in config.rpc_urls if _rpc_healthcheck(u, config.timeout_s)]
    if not alive:
        raise RuntimeError("All RPCs failed health-check (getversion).")
    if len(alive) != len(config.rpc_urls):
        LOG.warning("Some RPCs failed health-check; using %s/%s endpoints.", len(alive), len(config.rpc_urls))
    config = ScanConfig(
        rpc_urls=alive,
        last_n_blocks=config.last_n_blocks,
        out_dir=config.out_dir,
        timeout_s=config.timeout_s,
        retries=config.retries,
        progress_every_blocks=config.progress_every_blocks,
        max_notifications_samples_per_pair=config.max_notifications_samples_per_pair,
        resume=config.resume,
        workers=config.workers,
        exclude_eventnames=config.exclude_eventnames,
        summary_every_txs=config.summary_every_txs,
        max_tx_attempts=config.max_tx_attempts,
    )

    meta_rpc = config.rpc_urls[0]
    if progress and "rpc_urls" in progress and progress["rpc_urls"] != config.rpc_urls:
        LOG.warning("Resume file rpc_urls differs; continuing anyway (resume=%s).", progress["rpc_urls"])

    height = int(
        rpc_call(meta_rpc, "getblockcount", timeout_s=max(10.0, config.timeout_s), retries=config.retries)
    ) - 1
    start_height = max(0, height - (config.last_n_blocks - 1))

    # If resuming, continue from last scanned height+1
    next_height = start_height
    if progress and progress.get("next_height") is not None:
        next_height = max(int(progress["next_height"]), start_height)

    _write_json_atomic(
        run_meta_path,
        {
            "rpc_urls": config.rpc_urls,
            "started_at_utc": _utc_iso_z(),
            "range": {"start": start_height, "end": height, "count": config.last_n_blocks},
            "out_dir": str(config.out_dir),
            "resume": bool(config.resume),
            "workers": config.workers,
        },
    )

    LOG.info("RPCs: %s", ", ".join(config.rpc_urls))
    LOG.info("Range: %s..%s (%s blocks)", start_height, height, config.last_n_blocks)
    LOG.info("Workers: %s", config.workers)
    if config.resume:
        LOG.info("Resume enabled; starting at height=%s", next_height)

    stats = Counter(progress.get("stats", {})) if progress else Counter()
    errors = Counter(progress.get("errors", {})) if progress else Counter()
    excluded_events = {e for e in config.exclude_eventnames if e}

    # (contract,event) => count
    notif_counts = Counter(progress.get("notif_counts", {})) if progress else Counter()
    contract_counts = Counter(progress.get("contract_counts", {})) if progress else Counter()
    event_counts = Counter(progress.get("event_counts", {})) if progress else Counter()

    # keep small samples only in summary.json (not in ndjson)
    samples: Dict[str, List[dict]] = progress.get("samples", {}) if progress else {}
    # key serialization for JSON
    def key_str(contract: str, event: str) -> str:
        return f"{contract}::{event}"

    started = time.time()

    # Ensure output files exist early (even if there are 0 tx / 0 notifications).
    if not notifications_path.exists():
        notifications_path.write_text("", "utf-8")
    if not errors_path.exists():
        errors_path.write_text("", "utf-8")
    _write_json_atomic(
        summary_path,
        {
            "rpc_urls": config.rpc_urls,
            "range": {"start": start_height, "end": height},
            "stats": dict(stats),
            "errors": dict(errors),
            "top_contracts": [],
            "top_events": [],
            "top_pairs": [],
            "samples": samples,
            "updated_at_utc": _utc_iso_z(),
        },
    )
    _write_json_atomic(
        progress_path,
        {
            "rpc_urls": config.rpc_urls,
            "range": {"start": start_height, "end": height},
            "next_height": next_height,
            "stats": dict(stats),
            "errors": dict(errors),
            "notif_counts": dict(notif_counts),
            "contract_counts": dict(contract_counts),
            "event_counts": dict(event_counts),
            "samples": samples,
        },
    )

    # Streaming pipeline: enumerate blocks and process tx logs concurrently.
    rpc_pool = RpcPool(config.rpc_urls, cooldown_s=30.0)
    max_workers = max(1, int(config.workers))
    in_flight: Dict[Future, Tuple[int, str, str]] = {}
    attempts_by_txid: Dict[str, int] = {}

    def write_progress(next_h: int) -> None:
        _write_json_atomic_compact(
            progress_path,
            {
                "rpc_urls": config.rpc_urls,
                "range": {"start": start_height, "end": height},
                "next_height": next_h,
                "stats": dict(stats),
                "errors": dict(errors),
                "notif_counts": dict(notif_counts),
                "contract_counts": dict(contract_counts),
                "event_counts": dict(event_counts),
                "samples": samples,
                "exclude_eventnames": sorted(excluded_events),
            },
        )

    def write_summary() -> None:
        _write_json_atomic(
            summary_path,
            {
                "rpc_urls": config.rpc_urls,
                "range": {"start": start_height, "end": height},
                "stats": dict(stats),
                "errors": dict(errors),
                "top_contracts": contract_counts.most_common(25),
                "top_events": event_counts.most_common(25),
                "top_pairs": Counter(notif_counts).most_common(40),
                "samples": samples,
                "exclude_eventnames": sorted(excluded_events),
                "updated_at_utc": _utc_iso_z(),
            },
        )

    def process_done_future(fut: Future) -> None:
        h, txid, rpc_for_tx = in_flight.pop(fut)
        try:
            res = fut.result()
            al = res["applicationlog"]
        except Exception as e:
            # If one RPC is refusing connections, cooldown it and retry the same tx on another RPC.
            if _is_connection_refused(e):
                rpc_pool.mark_unhealthy(rpc_for_tx)

            attempts = attempts_by_txid.get(txid, 1)
            if attempts < max(1, int(config.max_tx_attempts)):
                attempts_by_txid[txid] = attempts + 1
                stats["tx_retried"] += 1
                # resubmit immediately on another RPC (do NOT count as done yet)
                rpc_retry = rpc_pool.pick()
                fut2 = pool.submit(
                    _fetch_applicationlog_for_tx,
                    rpc_retry,
                    txid,
                    timeout_s=config.timeout_s,
                    retries=config.retries,
                )
                in_flight[fut2] = (h, txid, rpc_retry)
                # still persist progress after the failed attempt
                errors["getapplicationlog_attempt_fail"] += 1
                _append_ndjson(
                    errors_path,
                    {
                        "ts_utc": _utc_iso_z(),
                        "height": h,
                        "txid": txid,
                        "rpc_url": rpc_for_tx,
                        "stage": "getapplicationlog_attempt",
                        "error": repr(e),
                    },
                )
                write_progress(next_height_current)
                return

            # Exhausted attempts: record final failure and count as done.
            errors["getapplicationlog"] += 1
            _append_ndjson(
                errors_path,
                {
                    "ts_utc": _utc_iso_z(),
                    "height": h,
                    "txid": txid,
                    "rpc_url": rpc_for_tx,
                    "stage": "getapplicationlog",
                    "error": repr(e),
                },
            )
        else:
            for ex in (al.get("executions") or []):
                vmstate = ex.get("vmstate", "")
                if "FAULT" in vmstate:
                    stats["executions_fault"] += 1
                for n in (ex.get("notifications") or []):
                    contract = _normalize_contract(n.get("contract"))
                    event = n.get("eventname") or ""
                    if event in excluded_events:
                        stats["notifications_excluded"] += 1
                        continue
                    stats["notifications"] += 1
                    state = stack_item_to_json(n.get("state"))

                    notif_counts[key_str(contract, event)] += 1
                    contract_counts[contract] += 1
                    event_counts[event] += 1

                    _append_ndjson(
                        notifications_path,
                        {
                            "height": h,
                            "txid": txid,
                            "contract": contract,
                            "eventname": event,
                            "vmstate": vmstate,
                            "state": state,
                            "rpc_url": rpc_for_tx,
                        },
                    )

                    ks = key_str(contract, event)
                    if len(samples.get(ks, [])) < config.max_notifications_samples_per_pair:
                        samples.setdefault(ks, []).append(
                            {"height": h, "txid": txid, "vmstate": vmstate, "state": state}
                        )

        stats["tx_done"] += 1
        stats["tx_done_since_summary"] += 1

        # Required: write JSON after every find (tx applicationlog completion)
        write_progress(next_height_current)
        if config.summary_every_txs > 0 and stats["tx_done_since_summary"] >= config.summary_every_txs:
            stats["tx_done_since_summary"] = 0
            write_summary()

    next_height_current = next_height
    stats.setdefault("tx_done", 0)
    stats.setdefault("tx_done_since_summary", 0)

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        for h in range(next_height, height + 1):
            next_height_current = h
            if config.progress_every_blocks > 0 and (h - start_height) % config.progress_every_blocks == 0:
                elapsed = time.time() - started
                LOG.info(
                    "Progress height=%s/%s blocks_ok=%s inflight=%s tx_done=%s notifs=%s applog_err=%s elapsed=%.1fs",
                    h,
                    height,
                    stats.get("blocks_ok", 0),
                    len(in_flight),
                    stats.get("tx_done", 0),
                    stats.get("notifications", 0),
                    errors.get("getapplicationlog", 0),
                    elapsed,
                )

            rpc_for_block = rpc_pool.pick()
            try:
                bh = rpc_call(rpc_for_block, "getblockhash", [h], timeout_s=config.timeout_s, retries=config.retries)
                blk = rpc_call(rpc_for_block, "getblock", [bh, 1], timeout_s=config.timeout_s, retries=config.retries)
            except Exception as e:
                errors["block_fetch"] += 1
                if _is_connection_refused(e):
                    rpc_pool.mark_unhealthy(rpc_for_block)
                _append_ndjson(
                    errors_path,
                    {"ts_utc": _utc_iso_z(), "height": h, "rpc_url": rpc_for_block, "stage": "block_fetch", "error": repr(e)},
                )
                write_progress(h + 1)
                continue

            stats["blocks_ok"] += 1
            txs = blk.get("tx") or []
            for tx in txs:
                txid = tx.get("hash")
                if not txid:
                    continue
                stats["tx_scanned"] += 1

                # Backpressure: keep at most max_workers in flight.
                while len(in_flight) >= max_workers:
                    done, _ = wait(in_flight.keys(), return_when=FIRST_COMPLETED)
                    for fut in done:
                        process_done_future(fut)

                rpc_for_tx = rpc_pool.pick()
                attempts_by_txid.setdefault(txid, 1)
                fut = pool.submit(
                    _fetch_applicationlog_for_tx,
                    rpc_for_tx,
                    txid,
                    timeout_s=config.timeout_s,
                    retries=config.retries,
                )
                in_flight[fut] = (h, txid, rpc_for_tx)

            # persist block progress so resume skips enumerated blocks
            write_progress(h + 1)

        # drain
        while in_flight:
            done, _ = wait(in_flight.keys(), return_when=FIRST_COMPLETED)
            for fut in done:
                process_done_future(fut)

    # Final summary
    write_summary()

    LOG.info("Done. Wrote outputs to %s", config.out_dir)


def main(argv: List[str]) -> int:
    p = argparse.ArgumentParser(description="Scan Neo N3 application logs and persist events incrementally.")
    p.add_argument(
        "--rpcs",
        dest="rpc_urls",
        default="",
        help="Comma-separated RPC URLs. Default: rpc1..rpc7 morph t5.",
    )
    p.add_argument(
        "--rpc",
        dest="rpc_url_legacy",
        default="",
        help="(Legacy) Single RPC URL. If provided, overrides --rpcs.",
    )
    p.add_argument("--last", dest="last_n_blocks", type=int, default=1000, help="How many last blocks to scan")
    p.add_argument("--out", dest="out_dir", default="", help="Output directory (default: scripts/output/<timestamp>)")
    p.add_argument("--timeout", dest="timeout_s", type=float, default=15.0, help="RPC timeout seconds")
    p.add_argument("--retries", dest="retries", type=int, default=3, help="RPC retries")
    p.add_argument("--workers", dest="workers", type=int, default=24, help="Parallel workers for getapplicationlog")
    p.add_argument(
        "--exclude-events",
        dest="exclude_events",
        default="Payment,Transfer,TransferX",
        help="Comma-separated event names to ignore (default: Payment,Transfer,TransferX)",
    )
    p.add_argument(
        "--summary-every",
        dest="summary_every_txs",
        type=int,
        default=200,
        help="Rewrite summary.json every N tx logs (progress.json is still written after every tx).",
    )
    p.add_argument(
        "--max-tx-attempts",
        dest="max_tx_attempts",
        type=int,
        default=7,
        help="Max attempts per tx (retries on other RPCs when one refuses connections).",
    )
    p.add_argument("--progress-every", dest="progress_every_blocks", type=int, default=25, help="Log progress every N blocks")
    p.add_argument("--samples-per-pair", dest="samples_per_pair", type=int, default=2, help="Keep up to N samples per (contract,event)")
    p.add_argument("--resume", action="store_true", help="Resume from existing progress.json in output dir")
    p.add_argument("--log-level", default="INFO", help="Logging level (DEBUG, INFO, WARNING, ERROR)")
    args = p.parse_args(argv)

    try:
        level = getattr(logging, str(args.log_level).upper())
    except Exception:
        level = logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s.%(msecs)03dZ %(levelname)s %(name)s - %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    out_dir = Path(args.out_dir) if args.out_dir else Path(__file__).resolve().parent / "output" / _utc_now_compact()

    if args.rpc_url_legacy:
        rpc_urls = [args.rpc_url_legacy.strip()]
    elif args.rpc_urls:
        rpc_urls = _parse_rpc_list(args.rpc_urls)
    else:
        rpc_urls = _default_rpc_list()

    exclude_eventnames = _parse_rpc_list(args.exclude_events)

    cfg = ScanConfig(
        rpc_urls=rpc_urls,
        last_n_blocks=max(1, int(args.last_n_blocks)),
        out_dir=out_dir,
        timeout_s=max(1.0, float(args.timeout_s)),
        retries=max(1, int(args.retries)),
        progress_every_blocks=max(0, int(args.progress_every_blocks)),
        max_notifications_samples_per_pair=max(0, int(args.samples_per_pair)),
        resume=bool(args.resume),
        workers=max(1, int(args.workers)),
        exclude_eventnames=exclude_eventnames,
        summary_every_txs=max(0, int(args.summary_every_txs)),
        max_tx_attempts=max(1, int(args.max_tx_attempts)),
    )

    try:
        scan(cfg)
        return 0
    except KeyboardInterrupt:
        LOG.warning("Interrupted.")
        return 130
    except Exception:
        LOG.exception("Scan failed.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

