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
mkdir -p "$DUMP_DIR"

MODE="${1:-}"

if [ "$MODE" = "--sql" ]; then
  OUT="$DUMP_DIR/nextstay_dump.sql.gz"
  echo "Exporting SQL gzip dump to: $OUT"
  docker exec -i nextstay_db_clean pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$OUT"
else
  OUT="$DUMP_DIR/nextstay_dump.dump"
  echo "Exporting custom dump to: $OUT"
  docker exec -i nextstay_db_clean pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$OUT"
fi

echo "DONE"
