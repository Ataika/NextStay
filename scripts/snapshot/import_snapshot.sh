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
SNAPSHOT_FILE="${1:-}"

if [ -z "$SNAPSHOT_FILE" ]; then
  echo "Usage: bash scripts/snapshot/import_snapshot.sh /absolute/or/relative/path/to/snapshot.dump"
  exit 1
fi

if [ ! -f "$SNAPSHOT_FILE" ]; then
  echo "ERROR: file not found: $SNAPSHOT_FILE"
  exit 1
fi

echo "Importing snapshot into DB '$DB_NAME' as user '$DB_USER'"
echo "Source: $SNAPSHOT_FILE"

cat "$SNAPSHOT_FILE" | docker exec -i nextstay_db_clean pg_restore \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges

echo "DONE"
