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

echo "Seeding DB: $DB_NAME"
docker exec -i nextstay_db_clean psql -U "$DB_USER" -d "$DB_NAME" < scripts/seed/seed.sql
echo "DONE"
