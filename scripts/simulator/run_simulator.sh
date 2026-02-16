#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." &>/dev/null && pwd)"
cd "$PROJECT_ROOT"

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $PROJECT_ROOT"
  exit 1
fi

set -a
source .env
set +a

DB_NAME="${DB_NAME:-nextstay}"
DB_USER="${DB_USER:-nextstay}"
ROOMS_PER_COMPANY="${ROOMS_PER_COMPANY:-80}"
BOOKINGS_PER_COMPANY="${BOOKINGS_PER_COMPANY:-10000}"

echo "Bootstrap simulator schema..."
docker exec -i nextstay_db_clean psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < scripts/simulator/sql/bootstrap_simulator.sql

echo "Generate OLTP data: rooms/company=$ROOMS_PER_COMPANY bookings/company=$BOOKINGS_PER_COMPANY"
docker exec -i nextstay_db_clean psql -v ON_ERROR_STOP=1 \
  -v rooms_per_company="$ROOMS_PER_COMPANY" \
  -v bookings_per_company="$BOOKINGS_PER_COMPANY" \
  -U "$DB_USER" -d "$DB_NAME" < scripts/simulator/sql/generate_oltp_data.sql

echo "DONE"
