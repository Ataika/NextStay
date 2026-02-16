#!/bin/bash

# Setup script for Airflow/Superset/DB roles.
# Notes:
# - Run from repo root or from scripts/ (it auto-detects root).
# - Requires docker containers to be up.

set -euo pipefail

# 1) Resolve project root (where .env lives)
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# 2) Load .env
if [ -f .env ]; then
  set -a
  source .env
  set +a
  echo "OK: .env loaded"
else
  echo "ERROR: .env not found in $PROJECT_ROOT"
  exit 1
fi

# Defaults (if not set in .env)
DB_USER="${DB_USER:-admin}"
DB_PASSWORD="${DB_PASSWORD:-nextstay_secure_pass}"
DB_NAME="${DB_NAME:-nextstay_db_v2}"
AIRFLOW_USER="${AIRFLOW_ADMIN_USER:-admin}"
AIRFLOW_PASS="${AIRFLOW_ADMIN_PASSWORD:-admin}"
SUPERSET_USER="${SUPERSET_ADMIN_USER:-admin}"
SUPERSET_PASS="${SUPERSET_ADMIN_PASSWORD:-admin}"

echo "Starting setup for DB: $DB_NAME (Airflow user: $AIRFLOW_USER)"

# 3) Airflow user
echo "Setting up Airflow user..."
docker exec nextstay_airflow airflow users delete --username "$AIRFLOW_USER" 2>/dev/null || true
docker exec nextstay_airflow airflow users create \
  --username "$AIRFLOW_USER" \
  --password "$AIRFLOW_PASS" \
  --firstname Admin \
  --lastname NextStay \
  --role Admin \
  --email admin@nextstay.com

# 4) Superset
echo "Setting up Superset..."
docker exec --user root nextstay_superset pip install psycopg2-binary --target /app/.venv/lib/python3.10/site-packages
docker exec nextstay_superset superset fab create-admin \
  --username "$SUPERSET_USER" \
  --password "$SUPERSET_PASS" \
  --firstname Admin \
  --lastname Superset \
  --email admin@superset.com || echo "Superset admin already exists"
docker exec nextstay_superset superset db upgrade
docker exec nextstay_superset superset init

# 5) Read-only user for Superset
echo "Creating RO user in DB: $DB_NAME..."
docker exec -it nextstay_db_clean psql -U "$DB_USER" -d "$DB_NAME" -c "
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'superset_ro') THEN
      CREATE USER superset_ro WITH PASSWORD 'read_only_pass';
    END IF;
  END \$\$;
  GRANT CONNECT ON DATABASE $DB_NAME TO superset_ro;
  GRANT USAGE ON SCHEMA public TO superset_ro;
  GRANT USAGE ON SCHEMA oltp TO superset_ro;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO superset_ro;
  GRANT SELECT ON ALL TABLES IN SCHEMA oltp TO superset_ro;
"

echo "DONE"
