# Minimal Integration Stack (DB + Site)

This gives you a local mini environment to validate how DPE behaves inside a real app flow:

1. Load context rows into a SQLite DB
2. Run pricing from DB -> write `price_decisions` + `published_prices`
3. Serve published prices in a tiny local web UI + JSON API

## 1) Initialize DB schema

```bash
python3 src/init_minimal_stack_db.py --db-path data/dpe_demo.db
```

## 2) Load synthetic contexts into DB

For a fast test:

```bash
python3 src/load_contexts_to_db.py \
  --db-path data/dpe_demo.db \
  --input-csv synthetic_hotel_pricing.csv \
  --limit 30000 \
  --replace
```

Use `--limit 0` to load all rows.

## 3) Run batch pricing from DB

```bash
python3 src/run_batch_pricing_db.py \
  --db-path data/dpe_demo.db \
  --replace-output \
  --limit 30000
```

This reads from `inventory_snapshots` and writes to:

- `price_decisions`
- `published_prices`

## 4) Run minimal site

```bash
python3 src/minimal_site.py --db-path data/dpe_demo.db --port 8080
```

Open:

- `http://127.0.0.1:8080/` (HTML table)
- `http://127.0.0.1:8080/api/published-prices?limit=20` (JSON)

You can filter with query params:

- `hotel_id`
- `stay_date`
- `limit`

## Notes

- This is intentionally lightweight for integration testing.
- It uses existing champion/fallback/rollout config:
  - `configs/serving_config_v1.json`
  - `configs/pricing_rules_v1.json`
- For production, replace SQLite with your main DB and scheduler/jobs.
