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

DUMP_DIR="$PROJECT_ROOT/scripts/data/dumps"
CUSTOM_DUMP="$DUMP_DIR/nextstay_dump.dump"
SQL_GZ="$DUMP_DIR/nextstay_dump.sql.gz"

if [ -f "$CUSTOM_DUMP" ]; then
  echo "Importing custom dump: $CUSTOM_DUMP"
  docker exec -i nextstay_db_clean pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists < "$CUSTOM_DUMP"
  echo "DONE"
  exit 0
fi

if [ -f "$SQL_GZ" ]; then
  echo "Importing SQL gzip dump: $SQL_GZ"
  gunzip -c "$SQL_GZ" | docker exec -i nextstay_db_clean psql -U "$DB_USER" -d "$DB_NAME"
  echo "DONE"
  exit 0
fi

echo "ERROR: no dump found in $DUMP_DIR"
echo "Expected:"
echo "  - $CUSTOM_DUMP"
echo "  - $SQL_GZ"
exit 1
