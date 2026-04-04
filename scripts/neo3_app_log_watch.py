#!/usr/bin/env python3
"""
Watch Neo N3 chain tip and print new blocks + tx application logs to stdout.

Output is newline-delimited JSON (NDJSON) to make it easy to pipe/parse.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import logging
import random
import sys
import time
import urllib.error
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence
from urllib.request import Request, urlopen


LOG = logging.getLogger("neo3_app_log_watch")


class RpcError(RuntimeError):
    pass


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
        except (RpcError, urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
            last_exc = e
            time.sleep(backoff_base_s * (2**i) + random.random() * 0.05)
    raise last_exc or RuntimeError("RPC failed")


def _is_connection_refused(e: BaseException) -> bool:
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


def _parse_list(s: str) -> List[str]:
    parts = [p.strip() for p in s.replace("\n", ",").replace("\t", ",").split(",")]
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


class RpcPool:
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
            return next(self._rr)
        for _ in range(len(self._all) * 2):
            u = next(self._rr)
            if u in healthy:
                return u
        return next(iter(healthy))


def _emit(obj: Any) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def watch(
    rpc_urls: List[str],
    *,
    poll_s: float,
    timeout_s: float,
    retries: int,
    start_height: Optional[int],
    exclude_events: List[str],
) -> None:
    alive = [u for u in rpc_urls if _rpc_healthcheck(u, timeout_s)]
    if not alive:
        raise RuntimeError("All RPCs failed health-check (getversion).")
    if len(alive) != len(rpc_urls):
        LOG.warning("Some RPCs failed health-check; using %s/%s endpoints.", len(alive), len(rpc_urls))
    pool = RpcPool(alive, cooldown_s=30.0)
    excluded = {e for e in exclude_events if e}

    meta_rpc = alive[0]
    tip = int(rpc_call(meta_rpc, "getblockcount", timeout_s=timeout_s, retries=retries)) - 1
    h = start_height if start_height is not None else tip

    LOG.info("Watching. RPCs=%s", ", ".join(alive))
    LOG.info("Starting at height=%s (tip=%s). poll=%.2fs", h, tip, poll_s)
    _emit({"ts_utc": _utc_iso_z(), "type": "watch_start", "rpc_urls": alive, "start_height": h, "tip": tip})

    while True:
        try:
            tip = int(rpc_call(meta_rpc, "getblockcount", timeout_s=timeout_s, retries=retries)) - 1
        except Exception as e:
            if _is_connection_refused(e):
                pool.mark_unhealthy(meta_rpc)
                meta_rpc = pool.pick()
            _emit({"ts_utc": _utc_iso_z(), "type": "error", "stage": "getblockcount", "rpc_url": meta_rpc, "error": repr(e)})
            time.sleep(poll_s)
            continue

        if h > tip:
            time.sleep(poll_s)
            continue

        # process all new heights up to tip
        while h <= tip:
            rpc_for_block = pool.pick()
            try:
                bh = rpc_call(rpc_for_block, "getblockhash", [h], timeout_s=timeout_s, retries=retries)
                blk = rpc_call(rpc_for_block, "getblock", [bh, 1], timeout_s=timeout_s, retries=retries)
            except Exception as e:
                if _is_connection_refused(e):
                    pool.mark_unhealthy(rpc_for_block)
                _emit(
                    {
                        "ts_utc": _utc_iso_z(),
                        "type": "error",
                        "stage": "getblock",
                        "height": h,
                        "rpc_url": rpc_for_block,
                        "error": repr(e),
                    }
                )
                break

            txs = blk.get("tx") or []
            txids = [t.get("hash") for t in txs if t.get("hash")]
            _emit(
                {
                    "ts_utc": _utc_iso_z(),
                    "type": "block",
                    "height": h,
                    "hash": blk.get("hash") or bh,
                    "time": blk.get("time"),
                    "tx_count": len(txids),
                    "txids": txids,
                }
            )

            for txid in txids:
                rpc_for_tx = pool.pick()
                try:
                    al = rpc_call(rpc_for_tx, "getapplicationlog", [txid], timeout_s=timeout_s, retries=retries)
                except Exception as e:
                    if _is_connection_refused(e):
                        pool.mark_unhealthy(rpc_for_tx)
                    _emit(
                        {
                            "ts_utc": _utc_iso_z(),
                            "type": "error",
                            "stage": "getapplicationlog",
                            "height": h,
                            "txid": txid,
                            "rpc_url": rpc_for_tx,
                            "error": repr(e),
                        }
                    )
                    continue

                # light decode: keep execution vmstate + notifications (with optional event filtering)
                executions_out = []
                for ex in (al.get("executions") or []):
                    notifs = []
                    for n in (ex.get("notifications") or []):
                        event = n.get("eventname") or ""
                        if event in excluded:
                            continue
                        notifs.append(
                            {
                                "contract": (n.get("contract") or "").lower(),
                                "eventname": event,
                                "state": n.get("state"),
                            }
                        )
                    executions_out.append(
                        {
                            "trigger": ex.get("trigger"),
                            "vmstate": ex.get("vmstate"),
                            "gasconsumed": ex.get("gasconsumed"),
                            "exception": ex.get("exception"),
                            "notifications": notifs,
                        }
                    )

                _emit(
                    {
                        "ts_utc": _utc_iso_z(),
                        "type": "tx",
                        "height": h,
                        "txid": txid,
                        "rpc_url": rpc_for_tx,
                        "executions": executions_out,
                    }
                )

            h += 1

        time.sleep(poll_s)


def main(argv: List[str]) -> int:
    p = argparse.ArgumentParser(description="Watch Neo N3 blocks and print tx application logs as NDJSON.")
    p.add_argument("--rpcs", default="", help="Comma-separated RPC URLs (default: rpc1..rpc7 morph t5).")
    p.add_argument("--rpc", dest="rpc_legacy", default="", help="(Legacy) Single RPC URL. Overrides --rpcs.")
    p.add_argument("--poll", type=float, default=1.0, help="Poll interval seconds.")
    p.add_argument("--timeout", type=float, default=15.0, help="RPC timeout seconds.")
    p.add_argument("--retries", type=int, default=3, help="RPC retries.")
    p.add_argument("--from-height", type=int, default=None, help="Start height (default: current tip).")
    p.add_argument(
        "--exclude-events",
        default="Payment,Transfer,TransferX",
        help="Comma-separated event names to ignore.",
    )
    p.add_argument("--log-level", default="INFO", help="Logging level (DEBUG, INFO, WARNING, ERROR).")
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

    if args.rpc_legacy:
        rpc_urls = [args.rpc_legacy.strip()]
    elif args.rpcs:
        rpc_urls = _parse_list(args.rpcs)
    else:
        rpc_urls = _default_rpc_list()

    exclude = _parse_list(args.exclude_events)

    watch(
        rpc_urls,
        poll_s=max(0.1, float(args.poll)),
        timeout_s=max(1.0, float(args.timeout)),
        retries=max(1, int(args.retries)),
        start_height=args.from_height,
        exclude_events=exclude,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

