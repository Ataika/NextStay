#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." &>/dev/null && pwd)"
PRICEENGINE_ROOT="$PROJECT_ROOT/backend/priceengine"

cd "$PROJECT_ROOT"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

DB_NAME="${DB_NAME:-nextstay}"
DB_USER="${DB_USER:-nextstay}"
DB_PASSWORD="${DB_PASSWORD:-nextstay}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5433}"
DATABASE_URL="${DATABASE_URL:-postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}}"
PRICING_LIMIT="${PRICING_LIMIT:-0}"
PRICING_BATCH_LIMIT="${PRICING_BATCH_LIMIT:-1500}"

cd "$PRICEENGINE_ROOT"

echo "Loading bundled pricing seed DB into Postgres..."
python3 src/load_postgres_pricing_seed.py \
  --database-url "$DATABASE_URL" \
  --input-source sqlite \
  --input-sqlite-db data/dpe_demo.db \
  --schema-path configs/feature_schema_v1.json \
  --limit "$PRICING_LIMIT" \
  --replace

echo "Running batch pricing into pricing.* tables..."
python3 src/batch_runner.py \
  --backend postgres \
  --database-url "$DATABASE_URL" \
  --input-table "pricing.inventory_snapshots" \
  --decisions-table "pricing.price_decisions" \
  --published-table "pricing.published_prices" \
  --schema-path configs/feature_schema_v1.json \
  --rules-path configs/pricing_rules_v1.json \
  --serving-config configs/serving_config_v1.json \
  --replace-output \
  --limit "$PRICING_BATCH_LIMIT"

echo "Pricing stack seeded and scored."
