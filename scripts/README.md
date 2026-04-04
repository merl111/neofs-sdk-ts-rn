# Scripts

## `neo3_app_log_scan.py`

Scans the **last N Neo N3 blocks** via JSON-RPC and extracts **ApplicationLog notifications** (`getapplicationlog`).

It is designed for long runs:

- Writes output **incrementally after every processed transaction** (after each `getapplicationlog`)
- Appends each notification as a single JSON line to `notifications.ndjson`
- Rewrites `summary.json` and `progress.json` frequently so you can resume safely

### Run

From the repo root:

```bash
python scripts/neo3_app_log_scan.py \
  --last 1000
```

By default it ignores noisy token events:

- `Payment`
- `Transfer`
- `TransferX`

Override with `--exclude-events` (comma-separated). Use an empty string to disable filtering:

```bash
python scripts/neo3_app_log_scan.py --last 1000 --exclude-events ""
```

Performance note: `progress.json` is written after every tx log; `summary.json` (heavier) is written periodically.
Tune with `--summary-every` (0 = only at end):

```bash
python scripts/neo3_app_log_scan.py --last 1000 --summary-every 200
```

By default it uses these RPC endpoints in parallel:

- `https://rpc1.morph.t5.fs.neo.org:51331`
- `https://rpc2.morph.t5.fs.neo.org:51331`
- `https://rpc3.morph.t5.fs.neo.org:51331`
- `https://rpc4.morph.t5.fs.neo.org:51331`
- `https://rpc5.morph.t5.fs.neo.org:51331`
- `https://rpc6.morph.t5.fs.neo.org:51331`
- `https://rpc7.morph.t5.fs.neo.org:51331`

To override the list:

```bash
python scripts/neo3_app_log_scan.py \
  --rpcs "https://rpc1.morph.t5.fs.neo.org:51331,https://rpc2.morph.t5.fs.neo.org:51331" \
  --workers 16 \
  --last 1000
```

Legacy single-RPC mode (overrides `--rpcs`):

```bash
python scripts/neo3_app_log_scan.py \
  --rpc "https://rpc1.morph.t5.fs.neo.org:51331" \
  --last 1000
```

### Output

By default it creates a timestamped directory:

- `scripts/output/<timestamp>/run.json`
- `scripts/output/<timestamp>/progress.json`
- `scripts/output/<timestamp>/summary.json`
- `scripts/output/<timestamp>/notifications.ndjson`
- `scripts/output/<timestamp>/errors.ndjson`

### Resume

Re-run with the same `--out` directory and `--resume`:

```bash
python scripts/neo3_app_log_scan.py \
  --last 1000 \
  --out "scripts/output/<timestamp>" \
  --resume
```

### Tips

- Use `--log-level DEBUG` to see more detail.
- If your RPC is rate-limited, increase `--timeout` and/or reduce retry pressure with `--retries`.

## `neo3_app_log_watch.py`

Watches the chain tip and prints **new blocks** and **transaction application logs** as **NDJSON** to stdout.

### Run

```bash
python scripts/neo3_app_log_watch.py
```

### Common options

- Start from a specific height:

```bash
python scripts/neo3_app_log_watch.py --from-height 19665000
```

- Change polling / verbosity:

```bash
python scripts/neo3_app_log_watch.py --poll 1.0 --log-level INFO
```

- Ignore noisy token events (default: `Payment,Transfer,TransferX`):

```bash
python scripts/neo3_app_log_watch.py --exclude-events "Payment,Transfer,TransferX"
```

