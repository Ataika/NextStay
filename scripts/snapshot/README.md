# Team Snapshot (DB)

This folder contains export/import scripts to synchronize data across teammates in dev.

## What is included

By default, export includes these schemas:
- `oltp`
- `stg`
- `core`
- `mart`
- `simulator`

This captures both source and analytics layers without changing project structure.

## Export

```bash
bash scripts/snapshot/export_snapshot.sh
```

Optional env vars:
- `SNAPSHOT_DIR` output folder
- `SNAPSHOT_FILE` full output path
- `SNAPSHOT_SCHEMAS` space-separated schema list

Example:

```bash
SNAPSHOT_SCHEMAS="oltp stg core mart simulator" \
SNAPSHOT_FILE="/tmp/nextstay_team.dump" \
bash scripts/snapshot/export_snapshot.sh
```

## Import

```bash
bash scripts/snapshot/import_snapshot.sh /path/to/nextstay_team.dump
```

Notes:
- Import uses `pg_restore --clean --if-exists` for included objects.
- Run only against local/dev DB.
