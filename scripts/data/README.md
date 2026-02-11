# Data Transfer (Team Sync)

This folder contains scripts to export/import a shared database snapshot so the whole team can work with identical data.

## Export (run on the source machine)

```bash
bash scripts/data/export_db.sh
```

Output:
- `scripts/data/dumps/nextstay_dump.dump` (pg_dump custom format)

## Import (run on team machines)

```bash
bash scripts/data/import_db.sh
```

Notes:
- Import **replaces** existing data in the target DB.
- Requires Docker containers to be running.

## Optional: compressed SQL format

You can also export a gzip SQL dump (slower restore but human‑readable):

```bash
bash scripts/data/export_db.sh --sql
```

This creates:
- `scripts/data/dumps/nextstay_dump.sql.gz`
