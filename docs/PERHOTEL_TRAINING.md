# Per-Hotel Model Training & Engine Tuning

## What was built

This feature extends the NextStay pricing engine from a single global model to a
**per-hotel model architecture**: the same algorithm and code runs for every hotel,
but each hotel is trained on its own historical data and can have its own business rules.

---

## Architecture overview

```
Data engineers
    │
    │  upload hotel-specific CSV
    ▼
POST /api/v1/training/upload-and-train
    │
    ├─► validates CSV columns against feature_schema_v1.json
    ├─► inserts rows into ml.pricingdata (hotel_id scoped)
    └─► creates a training job → background thread starts
            │
            ├─► queries ml.pricingdata WHERE hotel_id = ?
            ├─► trains LogisticRegression (same algo, hotel-specific data)
            ├─► saves  artifacts/hotel_{id}/{model_version}.pkl
            └─► records result in pricing.hotel_model_registry

Owner (via UI)
    │
    ├─► promotes a trained model → pricing.hotel_model_registry.is_active = TRUE
    └─► tunes per-hotel rules  → pricing.hotel_pricing_config (JSONB)

batch_runner.py  (future: load active model per hotel from registry)
    └─► currently uses model from CLI args / serving_config_v1.json
        (per-hotel routing hook: query hotel_model_registry for active model)
```

---

## New database tables

All three tables live in the `pricing` schema (same as `price_decisions` and
`published_prices`). Run the migration on an existing database:

```bash
docker exec -i nextstay_db_clean \
  psql -U nextstay -d nextstay \
  < scripts/migrate_add_training_tables.sql
```

### `pricing.hotel_model_registry`
Tracks every trained model artifact for every hotel.

| Column | Description |
|--------|-------------|
| `id` | Auto-increment primary key |
| `hotel_id` | Which hotel this model was trained for |
| `model_version` | Unique version string e.g. `hotel_3_v20260514_142301` |
| `model_path` | Absolute filesystem path to the `.pkl` file |
| `metrics_json` | JSONB with `validation` and `test` metrics (ROC-AUC, log-loss, Brier) |
| `is_active` | Only one model per hotel can be active at a time |
| `row_count` | Number of training rows used |
| `trained_at` | Timestamp of training completion |

### `pricing.training_jobs`
Async job tracker — the frontend polls this table while a model is being trained.

| Column | Description |
|--------|-------------|
| `id` | Job ID returned immediately after upload |
| `hotel_id` | Hotel being trained |
| `status` | `pending` → `running` → `completed` / `failed` |
| `triggered_at` | When the API call was made |
| `started_at` | When the background thread began |
| `completed_at` | When training finished (success or failure) |
| `error_message` | Filled on failure |
| `dataset_row_count` | Rows used from `ml.pricingdata` |
| `model_registry_id` | FK to `hotel_model_registry` on success |
| `config_json` | Train/validation fraction used |

### `pricing.hotel_pricing_config`
One row per hotel containing the owner's chosen business rules. Falls back to
global defaults if no row exists.

| Column | Description |
|--------|-------------|
| `hotel_id` | Primary key |
| `config_json` | JSONB: `min_price`, `max_price`, `max_daily_change_pct`, `weekend_multiplier`, `holiday_multiplier`, `rollout_fraction` |
| `updated_at` | Last save time |

---

## New API endpoints

All endpoints require an OWNER-role JWT (or the dev token).

### Training

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/training/hotels` | List hotels available for training |
| `POST` | `/api/v1/training/upload-and-train` | Upload CSV + queue training job |
| `GET` | `/api/v1/training/jobs?hotel_id=` | List training jobs |
| `GET` | `/api/v1/training/jobs/{id}` | Poll a single job |
| `GET` | `/api/v1/training/models?hotel_id=` | List model registry entries |
| `POST` | `/api/v1/training/models/{id}/promote` | Promote a model as active |

#### Upload request (multipart/form-data)
```
hotel_id          int      required
file              .csv     required — must include all required feature columns
train_fraction    float    optional, default 0.70
validation_fraction float  optional, default 0.15
```

### Engine tuning

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/pricing/config/{hotel_id}` | Read hotel config (returns defaults if none saved) |
| `PUT` | `/api/v1/pricing/config/{hotel_id}` | Upsert hotel config |

#### Config body (JSON)
```json
{
  "minPrice": 50.0,
  "maxPrice": 400.0,
  "maxDailyChangePct": 15.0,
  "weekendMultiplier": 1.25,
  "holidayMultiplier": 1.40,
  "rolloutFraction": 1.0
}
```

---

## New frontend pages

Both pages are OWNER-only and appear in the sidebar.

### Model Training — `/model-training`

Three sections:

1. **Upload & Train** — hotel selector, train/validation fraction sliders, CSV file
   picker, submit button. On submit the CSV is validated and loaded, a job is
   created, and the page auto-polls for completion every 4 seconds.

2. **Training Jobs** — table of all jobs for the selected hotel with status badges
   (`pending` / `running` / `completed` / `failed`), timestamps, row counts, and
   the resulting model version.

3. **Model Registry** — table of trained models with test metrics (AUC, log-loss,
   Brier score). An inactive model can be promoted; at most one model per hotel is
   active at a time.

### Engine Tuning — `/engine-tuning`

Three cards:

1. **Price Bounds** — minimum price floor (€), maximum price ceiling (€), max daily
   change percentage.

2. **Demand Multipliers** — weekend and holiday price multipliers (sliders, 1×–3×).

3. **Rollout Fraction** — slider from 0% (dynamic pricing off) to 100% (fully on).

Changes are saved per-hotel to `pricing.hotel_pricing_config`. The page also shows
which model version is currently active for the selected hotel.

---

## CSV format for data engineers

The uploaded CSV must contain all **required** columns listed in
`backend/priceengine/configs/feature_schema_v1.json`. Optional columns (marked
`required: false` in the schema) can be omitted — the engine handles them with NaN
imputation.

Minimum required columns include:
`hotel_id`, `hotel_segment`, `room_type_id`, `snapshot_date`, `stay_date`,
`lead_time`, `day_of_week`, `month`, `is_weekend`, `is_holiday`, `total_inventory`,
`booked_rooms`, `available_rooms`, `occupancy_rate`, `base_price`, `offered_price`,
`booking_made` (target label: 0 or 1).

The `hotel_id` column is overwritten server-side with the value passed in the form
so you cannot accidentally mix hotel data.

Minimum rows for training: **50** (the engine raises an error otherwise).
For a reliable model we recommend at least **1 000 rows** per hotel.

---

## Model artifacts

Per-hotel model files are written to:
```
backend/priceengine/artifacts/hotel_{hotel_id}/{model_version}.pkl
backend/priceengine/artifacts/hotel_{hotel_id}/{model_version}_metadata.json
```

These paths are stored in `pricing.hotel_model_registry.model_path`. They are
excluded from git via `.gitignore` (`backend/priceengine/artifacts/hotel_*/`).

In Docker, mount a persistent volume at `backend/priceengine/artifacts/` so
artifacts survive container restarts.

---

## Wiring the batch runner to per-hotel models (next step)

The `batch_runner.py` currently loads the model from CLI args or
`serving_config_v1.json`. To make it use per-hotel models automatically:

```python
# In _resolve_model_paths(), after falling back to serving config:
from sqlalchemy import create_engine, text

engine = create_engine(DATABASE_URL)
with engine.begin() as conn:
    row = conn.execute(
        text(
            "SELECT model_path, metadata_path "
            "FROM pricing.hotel_model_registry "
            "WHERE hotel_id = :hid AND is_active IS TRUE "
            "ORDER BY trained_at DESC LIMIT 1"
        ),
        {"hid": hotel_id},
    ).first()
if row:
    return str(row.model_path), str(row.metadata_path)
```

This lookup would run once per batch, not per row, so the performance cost is minimal.
