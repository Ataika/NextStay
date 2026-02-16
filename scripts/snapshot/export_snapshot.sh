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
SNAPSHOT_DIR="${SNAPSHOT_DIR:-$PROJECT_ROOT/scripts/snapshot/out}"
STAMP="$(date +%Y%m%d_%H%M%S)"
SNAPSHOT_FILE="${SNAPSHOT_FILE:-$SNAPSHOT_DIR/nextstay_snapshot_${STAMP}.dump}"

# Space-separated schema list. Keep public excluded by default to avoid local-only noise.
SNAPSHOT_SCHEMAS="${SNAPSHOT_SCHEMAS:-oltp stg core mart simulator}"

mkdir -p "$SNAPSHOT_DIR"

echo "Exporting snapshot from DB '$DB_NAME' as user '$DB_USER'"
echo "Target: $SNAPSHOT_FILE"

SCHEMA_FLAGS=()
for schema in $SNAPSHOT_SCHEMAS; do
  SCHEMA_FLAGS+=("-n" "$schema")
done

docker exec -i nextstay_db_clean pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -Fc \
  --no-owner \
  --no-privileges \
  "${SCHEMA_FLAGS[@]}" \
  > "$SNAPSHOT_FILE"

echo "DONE"
echo "Snapshot created: $SNAPSHOT_FILE"
