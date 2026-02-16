# Team Sync Guide

This guide syncs code, DB data, Airflow DAGs, and Superset metadata for teammates.

## 1) Pull code

```bash
git checkout dev
git pull origin dev
```

## 2) Start stack

```bash
docker compose up -d
```

## 3) Apply DB migrations

```bash
docker exec -i nextstay_db_clean psql -U nextstay -d nextstay < scripts/migrations/001_move_oltp_to_schema.sql
docker exec -i nextstay_db_clean psql -U nextstay -d nextstay < scripts/migrations/002_company_code_autofill.sql
docker exec -i nextstay_db_clean psql -U nextstay -d nextstay < backend/migrations/add_users_and_auth_sessions.sql
docker exec -i nextstay_db_clean psql -U nextstay -d nextstay < backend/migrations/add_payments_table.sql
```

## 4) Sync data via snapshot (recommended)

Export on source machine:

```bash
bash scripts/snapshot/export_snapshot.sh
```

Import on teammate machine:

```bash
bash scripts/snapshot/import_snapshot.sh /path/to/nextstay_snapshot_YYYYMMDD_HHMMSS.dump
```

## 5) Rebuild analytics layers

```bash
docker exec nextstay_airflow airflow dags trigger nextstay_simulator_pipeline
```

## 6) Verify

```bash
curl http://localhost:8000/api/v1/health
docker exec -i nextstay_db_clean psql -U nextstay -d nextstay -c "SELECT company_code, COUNT(*) FROM oltp.bookings GROUP BY 1 ORDER BY 1;"
```

## 7) Superset notes

- DAG SQLs are versioned in `analytics/dags/include/sql`.
- Superset app config is in `analytics/superset/superset_config.py`.
- Dashboards/charts created manually in Superset UI should be exported (ZIP) and shared separately.
