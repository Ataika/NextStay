# OLTP Simulator + DWH Pipeline

This module creates realistic test data directly in PostgreSQL and then runs ETL steps into `stg`, `core`, and `mart`.

## What it does

- creates/updates OLTP metadata for multi-company simulation (`C1`, `C2`)
- generates synthetic OLTP data in `oltp` schema tables:
  - `rooms`
  - `bookings`
  - `guest_tokens`
  - `cleaning_tasks`
- prepares data to be consumed by Airflow DAG ETL tasks

## Run simulator (manual)

```bash
bash scripts/simulator/run_simulator.sh
```

For existing databases created before the `oltp` schema split, run this one-time migration first:

```bash
docker exec -i nextstay_db_clean psql -U "$DB_USER" -d "$DB_NAME" < scripts/migrations/001_move_oltp_to_schema.sql
```

Optional scale params:

```bash
ROOMS_PER_COMPANY=150 BOOKINGS_PER_COMPANY=50000 bash scripts/simulator/run_simulator.sh
```

## Airflow DAG

DAG file:
- `analytics/dags/simulator_pipeline_dag.py`

SQL includes:
- `analytics/dags/include/sql/bootstrap_simulator.sql`
- `analytics/dags/include/sql/generate_oltp_data.sql`
- `analytics/dags/include/sql/load_stg_from_oltp.sql`
- `analytics/dags/include/sql/load_core_from_stg.sql`
- `analytics/dags/include/sql/load_mart_from_core.sql`

## Notes

- Simulator truncates OLTP tables before generating new data.
- Keep this only for dev/test environments.
