# PriceEngine Integration Report

## 1. Purpose of This Report

This report explains what was implemented to integrate the `priceengine` project into NextStay, why each new table was created, what each table contains, and how the full pricing flow works in practice.

It covers two connected deliverables:

1. the structural integration of the pricing engine into the main PostgreSQL-backed NextStay stack
2. a live demo scenario with 100 generated rooms, 30 occupied rooms, 70 available rooms, and model-generated prices displayed on the owner Rooms page

This report is intentionally detailed so it can be used as technical documentation, onboarding material, or a project handoff note.

## 2. High-Level Outcome

The pricing engine is now integrated into the main backend and database in an additive way.

That means:

1. the existing OLTP booking app still works as before
2. the existing `core` warehouse tables were not broken or replaced
3. a pricing-specific warehouse and serving path was added beside the existing stack
4. pricing data can now be loaded into PostgreSQL
5. the model can now read training data from PostgreSQL
6. pricing decisions can now be written back into PostgreSQL
7. owner-facing pages can inspect those decisions
8. the owner Rooms page can display predicted prices

Guest-facing booking and room-search pricing were intentionally left unchanged in this phase.

## 3. Architectural Decision

The integration uses four logical layers:

1. `public` OLTP tables for live app operations
2. `core` warehouse tables for standardized business history
3. `ml` tables for model-ready training data
4. `pricing` tables for live inference input and published outputs

The reason for this design is separation of concerns:

1. OLTP tables are optimized for running the app, not for training models
2. warehouse tables are optimized for clean historical structure
3. ML tables are optimized for stable, reproducible training inputs
4. pricing serving tables are optimized for current model decisions and UI/API reads

This avoids training directly from raw app data and avoids serving live prices from analytics tables.

## 4. Files Added or Updated

### Backend and PriceEngine

1. `backend/priceengine/src/postgres_pricing_stack.py`
2. `backend/priceengine/src/load_postgres_pricing_seed.py`
3. `backend/priceengine/src/run_batch_pricing_db.py`
4. `backend/priceengine/src/train_global_model.py`
5. `backend/app/api/v1/pricing_lab.py`
6. `backend/app/api/v1/rooms.py`
7. `backend/app/security/auth.py`
8. `backend/app/core/config.py`
9. `backend/app/main.py`

### Frontend

1. `frontend/src/pages/admin/PricingLabPage.tsx`
2. `frontend/src/components/RoomCard.tsx`
3. `frontend/src/api/api.ts`
4. `frontend/src/router/index.tsx`
5. `frontend/src/components/Sidebar.tsx`
6. `frontend/src/layouts/AppLayout.tsx`
7. `frontend/src/mocks/rooms.ts`
8. `frontend/src/pages/admin/AdminPage.tsx`

### Database and Seeding

1. `scripts/init-db.sql`
2. `scripts/seed/seed_pricing_engine.sh`
3. `scripts/seed/seed_live_inventory_demo.py`

## 5. Why New Tables Were Needed

The pricing engine does not work best from raw room rows or raw booking rows.

It expects data shaped like:

- hotel
- room type
- stay date
- snapshot date
- lead time
- inventory state
- price context
- optional market signals

That is different from the structure of the booking application, where the natural rows are:

- one room
- one booking
- one cleaning task

So new tables were needed for three reasons:

1. to standardize the data into the right grain for pricing
2. to separate training data from live serving data
3. to make debugging and reporting easier

## 6. New Schemas

Two new schemas were added:

### `ml`

Purpose:
- store a flat, stable, model-ready dataset for training

Why:
- training should not depend on ad hoc joins every time
- the same feature contract should be reproducible across runs

### `pricing`

Purpose:
- store current inventory inputs, price decisions, and final published prices

Why:
- current inference data and published outputs should live separately from historical warehouse facts
- the application should read current published prices from a serving-oriented layer

## 7. Detailed Table Report

### 7.1 `core.dim_hotels`

Purpose:
- define the hotel entity in the pricing warehouse

Why it was created:
- pricing features require a stable hotel identifier and hotel segment
- this makes single-hotel and multi-hotel pricing possible without hardcoding those values in every downstream table

Grain:
- one row per hotel version

Columns:

| Column | Meaning |
|---|---|
| `hotel_sk` | surrogate warehouse key |
| `hotel_id` | business hotel identifier used by the model |
| `hotel_name` | human-readable hotel name |
| `hotel_segment` | segment such as `budget_city`, `business`, `beach_resort`, `premium_luxury` |
| `timezone` | business timezone for the hotel |
| `city` | hotel city |
| `country_code` | ISO country code |
| `valid_from` | start of record validity |
| `valid_to` | end of record validity if historical versioning is used |
| `is_current` | marks the active row |

What it contains in practice:
- standardized metadata for each hotel used in pricing

Why it matters:
- the model treats hotel context as an input signal
- different hotel segments behave differently in demand and pricing

### 7.2 `core.dim_room_types`

Purpose:
- define room-type-level characteristics for pricing

Why it was created:
- the current pricing engine prices by room type, not by individual physical room
- room-type-level metadata should not be duplicated across every snapshot row if it can be modeled cleanly

Grain:
- one row per hotel-room-type version

Columns:

| Column | Meaning |
|---|---|
| `room_type_sk` | surrogate warehouse key |
| `room_type_id` | business room-type identifier used by the model |
| `hotel_sk` | FK to `core.dim_hotels` |
| `room_type_name` | room type label such as `Standard`, `Deluxe`, `Suite` |
| `category` | category label used in the app and warehouse |
| `max_occupancy` | maximum guests supported |
| `base_price_default` | default baseline price for the room type |
| `sea_view_flag` | whether the type supports sea view as a characteristic |
| `balcony_flag` | whether the type supports balcony as a characteristic |
| `amenity_score` | aggregate amenity richness score |
| `is_current` | marks the active row |
| `valid_from` | start of record validity |
| `valid_to` | end of record validity |

What it contains in practice:
- room-type metadata derived from standardized pricing data or room inventory

Why it matters:
- the model needs room-type context, occupancy capacity, and optional feature signals

### 7.3 `core.fact_pricing_snapshots`

Purpose:
- store standardized historical pricing observations at the correct grain

Why it was created:
- the pricing engine does not learn from booking rows directly
- it learns from snapshot rows representing what the business knew at a given date for a specific stay date and room type

Grain:
- one row per `(hotel, room type, snapshot date, stay date)`

Columns:

| Column | Meaning |
|---|---|
| `snapshot_sk` | surrogate fact key |
| `hotel_sk` | FK to `core.dim_hotels` |
| `room_type_sk` | FK to `core.dim_room_types` |
| `snapshot_date_sk` | FK to `core.dim_dates` for the observation date |
| `stay_date_sk` | FK to `core.dim_dates` for the target stay date |
| `lead_time` | days between snapshot date and stay date |
| `total_inventory` | total sellable rooms of that type |
| `booked_rooms` | rooms already sold |
| `available_rooms` | rooms still available |
| `occupancy_rate` | `booked_rooms / total_inventory` |
| `base_price` | baseline price before optimization |
| `offered_price` | price currently being offered |
| `final_price` | realized price if booked, else nullable |
| `booking_made` | whether a booking happened for that context |
| `rooms_booked` | number of rooms booked |
| `cancellation` | whether the booked row later canceled |
| `refundable_rate_flag` | refundability signal |
| `breakfast_included_flag` | breakfast bundle signal |
| `competitor_price` | optional competitor price feature |
| `event_score` | optional event-driven demand signal |
| `search_volume` | optional search-demand signal |
| `location_demand_index` | optional location attractiveness demand signal |
| `is_holiday` | holiday signal |
| `source_batch_id` | lineage identifier for the load |
| `created_at` | insertion timestamp |

What it contains in practice:
- the cleaned, warehouse-level business history for pricing

Why it matters:
- this is the canonical historical source for pricing ML
- it is the bridge between raw synthetic/live data and model-ready training rows

### 7.4 `ml.pricingdata`

Purpose:
- provide a flat feature table for model training

Why it was created:
- models should train from one stable table that already matches the feature contract
- this avoids repeating joins and transformation logic inside the training pipeline

Grain:
- one row per `(hotel_id, room_type_id, snapshot_date, stay_date)`

Columns:

| Column | Meaning |
|---|---|
| `hotel_id` | model hotel identifier |
| `hotel_segment` | model hotel segment |
| `room_type_id` | model room-type identifier |
| `room_type_name` | human-readable room type |
| `snapshot_date` | observation date |
| `stay_date` | target stay date |
| `lead_time` | days between snapshot and stay |
| `day_of_week` | day name of stay date |
| `week_of_year` | ISO week of stay |
| `month` | month of stay |
| `year` | year of stay |
| `season` | derived season label |
| `is_weekend` | weekend signal |
| `is_holiday` | holiday signal |
| `total_inventory` | total rooms of the type |
| `booked_rooms` | sold inventory |
| `available_rooms` | remaining inventory |
| `occupancy_rate` | sell-through rate |
| `base_price` | baseline price |
| `offered_price` | offered price |
| `final_price` | realized booked price if available |
| `booking_made` | target variable for the current modeling strategy |
| `rooms_booked` | number of booked rooms |
| `cancellation` | cancellation label |
| `max_occupancy` | room-type occupancy capacity |
| `refundable_rate_flag` | refundability feature |
| `breakfast_included_flag` | breakfast feature |
| `competitor_price` | optional feature |
| `event_score` | optional feature |
| `search_volume` | optional feature |
| `sea_view_flag` | optional feature |
| `balcony_flag` | optional feature |
| `amenity_score` | optional feature |
| `location_demand_index` | optional feature |
| `feature_schema_version` | schema contract version |
| `source_batch_id` | lineage identifier |
| `created_at` | insertion timestamp |

What it contains in practice:
- exactly the columns the model expects to train on

Why it matters:
- this table is the training contract
- it is reproducible, easier to validate, and easier to version than training straight from warehouse joins

### 7.5 `pricing.inventory_snapshots`

Purpose:
- provide the current inference input table

Why it was created:
- live inference should read a current-state table, not the historical training table directly
- inference and training have different lifecycles and operational needs

Grain:
- one row per `(hotel_id, room_type_id, snapshot_date, stay_date)`

Columns:
- mostly the same pricing context columns as `ml.pricingdata`
- no training-specific contract fields are required beyond what the scorer needs
- includes `source_batch_id` and `created_at` for lineage

Key business columns:
- hotel and room-type identifiers
- stay and snapshot dates
- lead time
- occupancy and availability
- base and offered price
- optional demand signals

What it contains in practice:
- the current or prepared set of contexts that should be scored by the price engine

Why it matters:
- this is the official model input for live batch pricing

### 7.6 `pricing.price_decisions`

Purpose:
- store full decision diagnostics from the model

Why it was created:
- the final price alone is not enough for debugging
- operators need to know how the engine arrived at a result

Grain:
- one row per scored pricing decision

Columns:

| Column | Meaning |
|---|---|
| `hotel_id` | hotel identifier |
| `room_type_id` | room type identifier |
| `stay_date` | stay date being priced |
| `snapshot_date` | observation date used for the decision |
| `offered_price` | final published offered price |
| `predicted_probability` | predicted booking probability at the chosen price |
| `expected_revenue` | expected revenue at the chosen price |
| `booking_made` | observed label if available |
| `cancellation` | observed cancellation label if available |
| `optimized_price` | optimizer-selected price before or alongside rules |
| `optimized_probability` | probability at optimizer-selected price |
| `optimized_expected_revenue` | expected revenue at optimizer-selected price |
| `rule_adjustments` | business rule markers applied to the result |
| `model_version` | model used |
| `rules_version` | business rules version used |
| `in_rollout` | whether the row was routed into dynamic pricing |
| `inference_status` | `ok`, `fallback`, or other serving status |
| `fallback_reason` | fallback explanation if needed |
| `created_at` | scoring timestamp |
| `source_batch_id` | lineage identifier |

What it contains in practice:
- the full audit trail of the scoring decision

Why it matters:
- this table powers debugging, explainability, monitoring, and lab inspection

### 7.7 `pricing.published_prices`

Purpose:
- store the final published price that the application can consume

Why it was created:
- applications should read a simple serving table rather than a diagnostic decision table

Grain:
- one row per published result

Columns:

| Column | Meaning |
|---|---|
| `hotel_id` | hotel identifier |
| `room_type_id` | room type identifier |
| `stay_date` | stay date being priced |
| `snapshot_date` | observation date used |
| `final_price` | final price after optimization and rules |
| `updated_at` | publish timestamp |
| `in_rollout` | rollout state |
| `inference_status` | publish status |
| `model_version` | model used |
| `rules_version` | rules used |
| `source_batch_id` | lineage identifier |

What it contains in practice:
- the answer the application needs to show a price

Why it matters:
- this is the serving layer for downstream UI/API reads

## 8. Supporting Existing Tables

The new pricing pipeline still depends on the existing app tables:

### `public.rooms`

Used for:
- room inventory
- room category
- room characteristics
- base displayed room price

### `public.bookings`

Used for:
- occupancy state
- sold inventory
- demo occupied rooms

### `core.dim_dates`

Used for:
- date normalization
- joining pricing facts to stay and snapshot dates
- deriving calendar fields like week, month, year, weekend

The original `core.dim_rooms`, `core.dim_clients`, `core.dim_users`, and `core.fact_bookings` were intentionally left unchanged.

## 9. Overall PriceEngine Process

This is the full process after integration.

### Step 1. Input Data Exists

Pricing starts from some source of room inventory and room-demand context.

In this project there are two main input patterns:

1. bundled pricing history from the local SQLite seed DB used to bootstrap Postgres
2. live demo inventory generated directly into the main app database

### Step 2. Data Is Standardized

The pricing engine requires a fixed contract.

The integration standardizes:

1. hotel segment values
2. room-type naming
3. date fields
4. lead time
5. availability math
6. occupancy rate
7. optional demand features

This happens in the loading pipeline, especially in:

- `backend/priceengine/src/load_postgres_pricing_seed.py`
- `scripts/seed/seed_live_inventory_demo.py`

### Step 3. Historical Data Is Materialized

For the warehouse path:

1. bundled historical pricing rows are loaded from the local seed DB
2. hotel metadata is inserted into `core.dim_hotels`
3. room-type metadata is inserted into `core.dim_room_types`
4. snapshot facts are inserted into `core.fact_pricing_snapshots`
5. a flat training table is materialized into `ml.pricingdata`
6. a serving input table is materialized into `pricing.inventory_snapshots`

### Step 4. Training Reads `ml.pricingdata`

The training script:

- reads `ml.pricingdata`
- validates that required columns exist
- prepares model features
- splits data by stay date
- trains the model
- writes artifacts and metrics

This happens in `backend/priceengine/src/train_global_model.py`.

### Step 5. Live Inference Reads `pricing.inventory_snapshots`

The batch scoring runner:

1. loads pricing contexts from `pricing.inventory_snapshots`
2. prepares model inputs using the shared feature contract
3. generates candidate prices
4. predicts booking probability for each candidate
5. calculates expected revenue
6. selects the best candidate
7. applies pricing rules
8. writes diagnostics to `pricing.price_decisions`
9. writes final published prices to `pricing.published_prices`

This happens in `backend/priceengine/src/run_batch_pricing_db.py`.

### Step 6. Backend Surfaces Results

The backend exposes pricing results in two ways:

1. `/api/v1/pricing-lab/published`
2. `/api/v1/pricing-lab/decision`

Also, `/api/v1/rooms` now enriches each room with:

- `dynamicPrice`
- `priceSource`
- `pricingStayDate`
- `pricingSnapshotDate`
- `pricingStatus`

This is done by mapping the latest published room-type price onto app rooms of the same category.

### Step 7. Frontend Displays Results

The frontend has two views:

1. `/pricing-lab`
   - shows published room-type pricing rows
   - lets the owner inspect decision details

2. `/admin`
   - shows live rooms
   - shows the predicted room-type price on each room card

## 10. The Demo Scenario With 100 Rooms

To make the pricing flow easier to understand visually, a live demo seed was added.

### What the demo does

The script `scripts/seed/seed_live_inventory_demo.py`:

1. truncates the existing app demo inventory
2. creates 100 rooms
3. generates room characteristics automatically
4. marks 30 rooms as occupied
5. inserts 30 live `Checked-in` bookings
6. aggregates the room inventory into 3 room-type pricing rows
7. runs the pricing model for today
8. publishes 3 prices for today

### Room distribution

The generated inventory uses:

1. `50` Standard rooms
2. `30` Deluxe rooms
3. `20` Suite rooms

Occupied distribution:

1. `15` Standard
2. `10` Deluxe
3. `5` Suite

Available distribution:

1. `35` Standard
2. `20` Deluxe
3. `15` Suite

### Generated room characteristics

Each room gets generated characteristics such as:

1. room number
2. category
3. base price
4. capacity
5. description
6. amenities
7. sea view flag
8. balcony flag

The generation logic intentionally creates variety by floor, category, and view/balcony combinations.

### Why only 3 predicted prices were published in the demo

The current model is room-type-based.

So the demo aggregates the 100 physical rooms into only 3 pricing contexts:

1. Standard
2. Deluxe
3. Suite

That means:

1. the model predicts one price for Standard
2. one for Deluxe
3. one for Suite

Then the backend maps those room-type prices back onto each physical room in the owner Rooms page.

## 11. Why the Rooms Page Shows the Same Predicted Price Inside a Category

This is an important business and technical point.

The current model is not a room-level price predictor.

It is a room-type-and-stay-date pricing engine.

So:

1. all Standard rooms share the same predicted price for the current stay date
2. all Deluxe rooms share the same predicted price
3. all Suite rooms share the same predicted price

This is correct for the current model design.

It is also useful pedagogically, because it clearly shows:

- physical room inventory on the Rooms page
- pricing logic at room-type level
- how room inventory is transformed into price contexts

If true room-level pricing is desired later, the model design would need to change.

## 12. How the Owner Rooms Page Works After Integration

The owner Rooms page still loads rooms from the backend, but now the backend enriches those rows.

### Backend side

The `/api/v1/rooms` endpoint:

1. loads the room rows from `public.rooms`
2. loads the latest published price by room type from `pricing.published_prices`
3. joins those by normalized category name
4. returns each room with pricing metadata

### Frontend side

The room card now shows:

1. the predicted price
2. the base room price
3. the pricing stay date

That makes it possible to compare:

- original room base price
- model-predicted room-type price

## 13. Why a Dev Owner Token Bridge Was Added

The frontend still supports mock authentication in development.

However, the pricing integration needed the owner UI to call the real backend without forcing the whole app to leave mock mode immediately.

So a temporary development bridge was added:

1. the mock owner token is accepted by the backend as an owner token in dev mode
2. owner pages can therefore call the real backend
3. this allows the rooms page and pricing lab page to work against live DB data while keeping the simpler dev login flow

This is a development convenience, not the final production security design.

## 14. Verification Performed

The implemented flow was verified in several ways.

### Database checks

Verified:

1. new schemas and tables were created
2. bundled pricing seed rows were loaded successfully
3. inventory snapshots were present
4. decisions and published prices were written back into Postgres

### Training checks

Verified:

1. `train_global_model.py` can read from `ml.pricingdata`
2. model artifacts were written successfully

### API checks

Verified:

1. `/api/v1/pricing-lab/published` returns live results
2. `/api/v1/pricing-lab/decision` returns decision details
3. `/api/v1/rooms` returns predicted-price fields
4. `/api/v1/bookings` reflects the 30 occupied-room demo state

### UI checks

Verified:

1. `/pricing-lab` can display published prices for the selected stay date
2. `/admin` can display the 100-room live demo inventory with predicted prices

## 15. Current Limits and Known Simplifications

This phase intentionally stops short of full guest-facing dynamic pricing.

Current limits:

1. guest booking and room-search prices are unchanged
2. room-level display uses room-type predictions
3. live demo pricing currently publishes only the current-day room-type rows in the 100-room scenario
4. the dev owner token bridge is temporary
5. the model still uses the current room-type pricing architecture, not a per-room model

These are not bugs in the current phase. They were deliberate scope boundaries.

## 16. Operational Commands

### Seed the warehouse-style pricing stack

```bash
bash /Users/pass1234/SoftProject/NextStay/scripts/seed/seed_pricing_engine.sh
```

This bootstrap now loads the bundled SQLite pricing seed DB into Postgres, so the normal integration flow no longer depends on reading the large synthetic CSV directly.

### Seed the 100-room live demo inventory and publish prices for today

```bash
python3 /Users/pass1234/SoftProject/NextStay/scripts/seed/seed_live_inventory_demo.py
```

### Open the owner Rooms page

```text
http://localhost:5173/admin
```

### Open the pricing lab page

```text
http://localhost:5173/pricing-lab
```

## 17. Final Summary

The integration is now structured around a clear pricing lifecycle:

1. create or collect pricing contexts
2. standardize them
3. store historical facts in `core`
4. materialize training rows in `ml`
5. score live contexts in `pricing`
6. publish final prices
7. expose those prices in owner-facing backend and frontend views

The most important conceptual takeaway is this:

The pricing engine does not price a physical room directly.
It prices a room type for a given stay date using a snapshot of inventory and demand context.
Then the application maps that room-type price back onto the actual rooms that belong to that category.

That is why the added tables exist, why the data is layered the way it is, and why the owner Rooms page now shows the pricing results in a way that makes the full process visible.
