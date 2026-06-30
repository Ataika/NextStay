# DWH — dbt CORE + MART — Implementation Plan

> **Implementation:** follow tasks step by step. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the dimensional warehouse in dbt — fix the broken staging, add CORE (dims + fact + SCD snapshot) and MART (occupancy, RevPAR, loyalty) layers on top of the real OLTP schema, with dbt tests, runnable and verified locally.

**Architecture:** OLTP `public` → `stg` (views, real columns) → `core` (dims + `fct_bookings`, tables) → `mart` (aggregates, tables) → Superset. SCD2 history for rooms via a dbt snapshot. Verified locally with a **dbt-duckdb** dev target + CSV **seeds** (no Docker/Postgres needed here); **Postgres remains the prod target**. SQL kept portable (ANSI + `dbt.date_spine`); no Postgres-only syntax.

**Tech Stack:** dbt-core + dbt-duckdb (local verify) / dbt-postgres (prod), DuckDB 1.5.3, CSV seeds.

**Spec:** `docs/superpowers/specs/2026-06-12-hotel-sync-simulator-design.md` is unrelated; DWH design is in this plan + `context/PROJECT.md` (6 schemas) + `context/REPORT-OUTLINE.md`.

**Среда:** sandbox ломает `cd`/`grep`/`find`; абсолютные пути, `git -C <repo>`. Docker НЕ запущен, Postgres недоступен → проверяем на DuckDB.
**dbt рабочая директория:** `/Users/ataika/Desktop/NextStay-hotel-sync/analytics/dbt`.
**dbt ставится в ОТДЕЛЬНЫЙ venv** `/Users/ataika/Desktop/NextStay-hotel-sync/analytics/.dbt-venv` (НЕ в backend/.venv — чтобы не ломать зависимости бэкенда; dbt-core тянет свои версии jinja2/pydantic/agate).
**dbt-команды (target=duckdb, без cd — через `--project-dir`/`--profiles-dir`). Обозначаем `<dbt>` =**
`/Users/ataika/Desktop/NextStay-hotel-sync/analytics/.dbt-venv/bin/dbt <cmd> --project-dir /Users/ataika/Desktop/NextStay-hotel-sync/analytics/dbt --profiles-dir /Users/ataika/Desktop/NextStay-hotel-sync/analytics/dbt --target duckdb`

---

## Real OLTP schema (verified — build against THIS)
- `rooms`: `id, hotel_id, number, category, status, price, capacity, description, amenities` (NO created_at, NO room_type/price_per_night).
- `bookings`: `id, guest_name, guest_email, room_id, room_number, check_in, check_out, status, created_at, notes, stripe_session_id, stripe_payment_intent_id, amount_paid`.
- `hotels` (Phase 1): `id, code, name, webhook_url, hmac_secret, active, created_at`.

## File Structure
- Modify: `analytics/dbt/profiles.yml` (add `duckdb` dev target; fix `dev` postgres target to match docker-compose: user `nextstay`, db `nextstay`, host `db`/`localhost`).
- Modify: `analytics/dbt/dbt_project.yml` (model materializations per layer; drop `example`).
- Delete: `analytics/dbt/models/example/` (default junk).
- Create seeds: `analytics/dbt/seeds/seed_rooms.csv`, `seed_bookings.csv`, `seed_hotels.csv` + `seeds/properties.yml`.
- Modify: `analytics/dbt/models/staging/sources.yml`, `stg_rooms.sql`; create `stg_bookings.sql`, `stg_hotels.sql`, `staging/schema.yml`.
- Create core: `models/core/{dim_dates,dim_hotels,dim_room_types,dim_rooms,dim_guests,fct_bookings}.sql` + `core/schema.yml`.
- Create snapshot: `snapshots/scd_rooms.sql`.
- Create marts: `models/mart/{mart_occupancy,mart_revpar,mart_loyalty}.sql` + `mart/schema.yml`.

---

## Task 1: dbt setup — install, profiles, project config, seeds

- [ ] **Step 1: Create a DEDICATED dbt venv and install dbt with both adapters** (keeps dbt's deps away from the backend venv):
Run: `/opt/anaconda3/bin/python3 -m venv /Users/ataika/Desktop/NextStay-hotel-sync/analytics/.dbt-venv`
Then: `/Users/ataika/Desktop/NextStay-hotel-sync/analytics/.dbt-venv/bin/pip install -q --upgrade pip && /Users/ataika/Desktop/NextStay-hotel-sync/analytics/.dbt-venv/bin/pip install -q dbt-core dbt-duckdb dbt-postgres`
Verify: `/Users/ataika/Desktop/NextStay-hotel-sync/analytics/.dbt-venv/bin/dbt --version` (shows core + duckdb + postgres). Add `analytics/.dbt-venv/` to `.gitignore`.

- [ ] **Step 2: Replace `analytics/dbt/profiles.yml`** with both targets (duckdb default for local verify; postgres for prod, matching docker-compose `db` service env `DB_USER/DB_NAME=nextstay`):
```yaml
dbt_nexstay:
  target: duckdb
  outputs:
    duckdb:
      type: duckdb
      path: "{{ env_var('DBT_DUCKDB_PATH', '/Users/ataika/Desktop/NextStay-hotel-sync/analytics/dbt/dev.duckdb') }}"
      threads: 4
    postgres:
      type: postgres
      threads: 4
      host: "{{ env_var('DBT_PG_HOST', 'localhost') }}"
      port: "{{ env_var('DBT_PG_PORT', 5433) | int }}"
      user: "{{ env_var('DBT_PG_USER', 'nextstay') }}"
      pass: "{{ env_var('DBT_PG_PASS', 'nextstay') }}"
      dbname: "{{ env_var('DBT_PG_DBNAME', 'nextstay') }}"
      schema: stg
```
(Postgres prod target now matches `docker-compose.yml` defaults; both DB name and creds are env-overridable. Port 5433 = the host-mapped port from compose.)

- [ ] **Step 3: Edit `analytics/dbt/dbt_project.yml`** — replace the `models:` block with per-layer materializations and remove the `example` config:
```yaml
models:
  dbt_nexstay:
    staging:
      +materialized: view
      +schema: stg
    core:
      +materialized: table
      +schema: core
    mart:
      +materialized: table
      +schema: mart
seeds:
  dbt_nexstay:
    +schema: raw
```
Also add a `snapshots` path config is already present (`snapshot-paths: ["snapshots"]`).

- [ ] **Step 4: Delete the example models:** remove files `analytics/dbt/models/example/my_first_dbt_model.sql`, `my_second_dbt_model.sql`, `schema.yml`, and the now-stray `models/test_ci.sql` if it references example. (Use `git -C <repo> rm`.) Keep `models/staging/`.

- [ ] **Step 5: Create seed CSVs** (small but representative; dates within 2026):
`analytics/dbt/seeds/seed_hotels.csv`:
```csv
id,code,name,active
1,GRAND_BISHKEK,Grand Bishkek,true
2,ALA_TOO_INN,Ala-Too Inn,true
```
`analytics/dbt/seeds/seed_rooms.csv`:
```csv
id,hotel_id,number,category,status,price,capacity
1,1,101,Standard,Available,100.0,2
2,1,102,Deluxe,Occupied,150.0,2
3,1,201,Suite,Available,250.0,4
4,2,101,Standard,Available,90.0,2
5,2,102,Deluxe,Cleaning,140.0,3
```
`analytics/dbt/seeds/seed_bookings.csv`:
```csv
id,guest_name,guest_email,room_id,room_number,check_in,check_out,status,created_at,amount_paid
1,Alice,alice@example.com,1,101,2026-06-01,2026-06-04,Checked-out,2026-05-20,300.0
2,Bob,bob@example.com,2,102,2026-06-02,2026-06-05,Checked-in,2026-05-22,450.0
3,Alice,alice@example.com,3,201,2026-06-10,2026-06-12,Confirmed,2026-06-01,500.0
4,Carol,carol@example.com,4,101,2026-06-03,2026-06-06,Cancelled,2026-05-25,270.0
5,Alice,alice@example.com,1,101,2026-07-01,2026-07-03,Upcoming,2026-06-15,200.0
```
`analytics/dbt/seeds/properties.yml`:
```yaml
version: 2
seeds:
  - name: seed_bookings
    config:
      column_types:
        check_in: timestamp
        check_out: timestamp
        created_at: timestamp
        amount_paid: double
  - name: seed_rooms
    config:
      column_types:
        price: double
```

- [ ] **Step 6: Verify dbt connects + seeds load:**
Run: `<dbt> seed` (with the project/profiles/target flags above). Expected: 3 seeds loaded into `raw` schema of `dev.duckdb`. Then `<dbt> debug` → "All checks passed".
Add `analytics/dbt/dev.duckdb` and `analytics/dbt/target/`, `analytics/dbt/dbt_packages/`, `logs/` to `.gitignore`.

- [ ] **Step 7: Commit:**
```
git -C /Users/ataika/Desktop/NextStay-hotel-sync add analytics/dbt/profiles.yml analytics/dbt/dbt_project.yml analytics/dbt/seeds .gitignore
git -C /Users/ataika/Desktop/NextStay-hotel-sync rm -r analytics/dbt/models/example
git -C /Users/ataika/Desktop/NextStay-hotel-sync commit -m "build(dwh): dbt duckdb dev target + postgres prod target, seeds, project config"
```

---

## Task 2: Staging layer (fix to real schema)

The staging models read from **seeds** in the duckdb target via `{{ ref(...) }}` (so they run locally). For the Postgres prod target, a follow-up will switch sources to `{{ source(...) }}` — but to keep ONE portable codebase that runs on both, staging selects from a `ref()` to the seed when present. To avoid env-branching, **staging reads from seeds** (the seeds mirror the OLTP tables 1:1); the prod deployment loads the same-named tables. Document this in `staging/schema.yml`.

- [ ] **Step 1: Replace `analytics/dbt/models/staging/stg_rooms.sql`** with the REAL columns:
```sql
with source as (
    select * from {{ ref('seed_rooms') }}
)
select
    id as room_id,
    hotel_id,
    number as room_number,
    category as room_category,
    status as room_status,
    price as price_per_night,
    capacity,
    current_timestamp as dbt_loaded_at
from source
```

- [ ] **Step 2: Create `stg_bookings.sql`:**
```sql
with source as (
    select * from {{ ref('seed_bookings') }}
)
select
    id as booking_id,
    guest_name,
    lower(guest_email) as guest_email,
    room_id,
    room_number,
    cast(check_in as date) as check_in_date,
    cast(check_out as date) as check_out_date,
    status as booking_status,
    cast(created_at as date) as created_date,
    amount_paid,
    current_timestamp as dbt_loaded_at
from source
```

- [ ] **Step 3: Create `stg_hotels.sql`:**
```sql
with source as (
    select * from {{ ref('seed_hotels') }}
)
select
    id as hotel_id,
    code as hotel_code,
    name as hotel_name,
    active as is_active,
    current_timestamp as dbt_loaded_at
from source
```

- [ ] **Step 4: Replace `staging/sources.yml`** content note + create `staging/schema.yml`** with column docs + tests:
```yaml
version: 2
models:
  - name: stg_rooms
    columns:
      - name: room_id
        tests: [unique, not_null]
      - name: hotel_id
        tests: [not_null]
  - name: stg_bookings
    columns:
      - name: booking_id
        tests: [unique, not_null]
      - name: room_id
        tests: [not_null]
  - name: stg_hotels
    columns:
      - name: hotel_id
        tests: [unique, not_null]
```
(Remove the old `sources.yml` if sources are no longer referenced, OR keep it for the prod-source variant. For this duckdb-verified build, delete `sources.yml` to avoid an unused-source warning.)

- [ ] **Step 5: Run + test staging:**
`<dbt> run -s staging` then `<dbt> test -s staging`. Expected: 3 views built, all tests pass.

- [ ] **Step 6: Commit:**
```
git -C ... add analytics/dbt/models/staging
git -C ... commit -m "build(dwh): staging models on real OLTP schema (rooms/bookings/hotels)"
```

---

## Task 3: CORE dimensions

- [ ] **Step 1: `models/core/dim_dates.sql`** (portable date spine via built-in `dbt.date_spine`):
```sql
with spine as (
    {{ dbt.date_spine(
        datepart="day",
        start_date="cast('2026-01-01' as date)",
        end_date="cast('2027-01-01' as date)"
    ) }}
)
select
    cast(date_day as date) as date_key,
    extract(year from date_day) as year,
    extract(month from date_day) as month,
    extract(day from date_day) as day_of_month,
    extract(dow from date_day) as day_of_week,
    case when extract(dow from date_day) in (0, 6) then true else false end as is_weekend
from spine
```

- [ ] **Step 2: `models/core/dim_hotels.sql`:**
```sql
select
    hotel_id,
    hotel_code,
    hotel_name,
    is_active
from {{ ref('stg_hotels') }}
```

- [ ] **Step 3: `models/core/dim_room_types.sql`** (distinct category per hotel):
```sql
select
    {{ dbt_utils.generate_surrogate_key(['hotel_id', 'room_category']) }} as room_type_key,
    hotel_id,
    room_category,
    min(price_per_night) as min_price,
    max(price_per_night) as max_price,
    count(*) as room_count
from {{ ref('stg_rooms') }}
group by hotel_id, room_category
```
NOTE: `dbt_utils.generate_surrogate_key` requires the `dbt_utils` package. To avoid a package dep, replace with a portable hash: `md5(cast(hotel_id as varchar) || '-' || room_category) as room_type_key`. Use the md5 form.

- [ ] **Step 4: `models/core/dim_rooms.sql`:**
```sql
select
    r.room_id,
    r.hotel_id,
    r.room_number,
    r.room_category,
    r.capacity,
    r.price_per_night,
    r.room_status,
    md5(cast(r.hotel_id as varchar) || '-' || r.room_category) as room_type_key
from {{ ref('stg_rooms') }} r
```

- [ ] **Step 5: `models/core/dim_guests.sql`** (unique guests for loyalty):
```sql
select
    guest_email,
    min(guest_name) as guest_name,
    count(*) as lifetime_bookings,
    min(created_date) as first_booking_date
from {{ ref('stg_bookings') }}
where guest_email is not null
group by guest_email
```

- [ ] **Step 6: `core/schema.yml`** tests:
```yaml
version: 2
models:
  - name: dim_dates
    columns:
      - name: date_key
        tests: [unique, not_null]
  - name: dim_hotels
    columns:
      - name: hotel_id
        tests: [unique, not_null]
  - name: dim_rooms
    columns:
      - name: room_id
        tests: [unique, not_null]
      - name: hotel_id
        tests:
          - relationships:
              to: ref('dim_hotels')
              field: hotel_id
  - name: dim_guests
    columns:
      - name: guest_email
        tests: [unique, not_null]
```

- [ ] **Step 7:** `<dbt> run -s core` + `<dbt> test -s core` → all green. Commit:
```
git -C ... add analytics/dbt/models/core
git -C ... commit -m "build(dwh): core dimensions (dates, hotels, room_types, rooms, guests)"
```

---

## Task 4: CORE fact — fct_bookings

- [ ] **Step 1: `models/core/fct_bookings.sql`** (grain = one booking):
```sql
select
    b.booking_id,
    b.guest_email,
    b.room_id,
    r.hotel_id,
    b.check_in_date,
    b.check_out_date,
    cast(b.check_out_date as date) - cast(b.check_in_date as date) as nights,
    b.booking_status,
    b.amount_paid,
    case when b.booking_status not in ('Cancelled', 'Expired') then b.amount_paid else 0 end as realized_revenue,
    b.created_date
from {{ ref('stg_bookings') }} b
left join {{ ref('stg_rooms') }} r on b.room_id = r.room_id
```
(`date - date` yields integer days in both DuckDB and Postgres.)

- [ ] **Step 2: add to `core/schema.yml`:**
```yaml
  - name: fct_bookings
    columns:
      - name: booking_id
        tests: [unique, not_null]
      - name: room_id
        tests:
          - relationships:
              to: ref('dim_rooms')
              field: room_id
      - name: booking_status
        tests:
          - accepted_values:
              values: ['Pending','Confirmed','Upcoming','Checked-in','Checked-out','Cancelled','Expired']
```

- [ ] **Step 3:** `<dbt> run -s fct_bookings` + `<dbt> test -s fct_bookings` → green. Commit:
```
git -C ... add analytics/dbt/models/core
git -C ... commit -m "build(dwh): fct_bookings fact table + tests"
```

---

## Task 5: SCD2 snapshot for rooms

- [ ] **Step 1: `analytics/dbt/snapshots/scd_rooms.sql`** (timestamp strategy on room price/status):
```sql
{% snapshot scd_rooms %}
{{
    config(
        target_schema='core',
        unique_key='room_id',
        strategy='check',
        check_cols=['price_per_night', 'room_status', 'room_category']
    )
}}
select room_id, hotel_id, room_number, room_category, room_status, price_per_night, capacity
from {{ ref('stg_rooms') }}
{% endsnapshot %}
```
(`check` strategy doesn't need an updated_at column — it diffs `check_cols`, giving SCD2 history of price/status changes.)

- [ ] **Step 2:** `<dbt> snapshot` → builds `core.scd_rooms` with dbt SCD2 columns (`dbt_valid_from`/`dbt_valid_to`). Run twice to confirm idempotency (second run = 0 changes). Commit:
```
git -C ... add analytics/dbt/snapshots/scd_rooms.sql
git -C ... commit -m "build(dwh): SCD2 snapshot for rooms (price/status history)"
```

---

## Task 6: MART aggregates

- [ ] **Step 1: `models/mart/mart_occupancy.sql`** (occupied room-nights vs available, per hotel×date):
```sql
with dates as (select date_key from {{ ref('dim_dates') }}),
rooms as (select hotel_id, room_id from {{ ref('dim_rooms') }}),
available as (
    select r.hotel_id, d.date_key, count(*) as available_rooms
    from rooms r cross join dates d
    group by r.hotel_id, d.date_key
),
occupied as (
    select r.hotel_id, d.date_key, count(distinct f.room_id) as occupied_rooms
    from {{ ref('fct_bookings') }} f
    join {{ ref('dim_rooms') }} r on f.room_id = r.room_id
    join dates d on d.date_key >= f.check_in_date and d.date_key < f.check_out_date
    where f.booking_status not in ('Cancelled', 'Expired')
    group by r.hotel_id, d.date_key
)
select
    a.hotel_id,
    a.date_key,
    a.available_rooms,
    coalesce(o.occupied_rooms, 0) as occupied_rooms,
    round(coalesce(o.occupied_rooms, 0) * 1.0 / nullif(a.available_rooms, 0), 4) as occupancy_rate
from available a
left join occupied o on a.hotel_id = o.hotel_id and a.date_key = o.date_key
```

- [ ] **Step 2: `models/mart/mart_revpar.sql`** (RevPAR = realized revenue / available rooms, per hotel×date):
```sql
with occ as (select * from {{ ref('mart_occupancy') }}),
revenue as (
    select r.hotel_id, d.date_key,
           sum(f.realized_revenue * 1.0 / nullif(f.nights, 0)) as room_revenue
    from {{ ref('fct_bookings') }} f
    join {{ ref('dim_rooms') }} r on f.room_id = r.room_id
    join {{ ref('dim_dates') }} d on d.date_key >= f.check_in_date and d.date_key < f.check_out_date
    where f.booking_status not in ('Cancelled', 'Expired')
    group by r.hotel_id, d.date_key
)
select
    occ.hotel_id,
    occ.date_key,
    occ.available_rooms,
    coalesce(rev.room_revenue, 0) as room_revenue,
    round(coalesce(rev.room_revenue, 0) / nullif(occ.available_rooms, 0), 2) as revpar
from occ
left join revenue rev on occ.hotel_id = rev.hotel_id and occ.date_key = rev.date_key
```

- [ ] **Step 3: `models/mart/mart_loyalty.sql`:**
```sql
select
    g.guest_email,
    g.guest_name,
    g.lifetime_bookings,
    count(f.booking_id) filter (where f.booking_status not in ('Cancelled', 'Expired')) as realized_bookings,
    sum(f.realized_revenue) as lifetime_value,
    case when g.lifetime_bookings >= 3 then 'VIP'
         when g.lifetime_bookings = 2 then 'Returning'
         else 'New' end as loyalty_tier
from {{ ref('dim_guests') }} g
left join {{ ref('fct_bookings') }} f on f.guest_email = g.guest_email
group by g.guest_email, g.guest_name, g.lifetime_bookings
```
(`count(...) filter (where ...)` is supported by both DuckDB and Postgres.)

- [ ] **Step 4: `mart/schema.yml`** tests:
```yaml
version: 2
models:
  - name: mart_occupancy
    columns:
      - name: occupancy_rate
        tests:
          - dbt_utils.accepted_range: # if dbt_utils unavailable, replace with a not_null test
              min_value: 0
              max_value: 1
    # If dbt_utils is not installed, use instead:
    # columns: [{name: hotel_id, tests: [not_null]}]
  - name: mart_loyalty
    columns:
      - name: guest_email
        tests: [unique, not_null]
```
NOTE: do NOT depend on `dbt_utils`. Use only built-in tests: `not_null`, `unique`, `accepted_values`, `relationships`. Replace the accepted_range above with `not_null` on `hotel_id`/`occupancy_rate`.

- [ ] **Step 5: full build:** `<dbt> build` (runs seeds → models → snapshot → tests in DAG order). Expected: everything PASS. Commit:
```
git -C ... add analytics/dbt/models/mart
git -C ... commit -m "build(dwh): marts — occupancy, RevPAR, loyalty + tests"
```

---

## Self-Review
- **Spec coverage:** stg fixed to real schema; core dims (dates/hotels/room_types/rooms/guests) + fct_bookings; SCD2 via snapshot; marts occupancy/RevPAR/loyalty — all present. Profile fixed for both duckdb (verify) and postgres (prod).
- **No external package deps:** surrogate keys via `md5(...)`, only built-in dbt tests (no dbt_utils). `dbt.date_spine` is built into dbt-core.
- **Portability:** ANSI SQL; `date - date`→int, `extract`, `filter (where)`, `current_timestamp` all work on DuckDB + Postgres. No Postgres-only constructs.
- **Verification:** `dbt build` on the duckdb target with seeds proves models compile, run, and pass tests locally without Docker. Prod run: set target=postgres after `docker compose up -d db` and load OLTP (or point staging at `source()`).

## Notes / follow-ups
- Staging currently reads from **seeds** (which mirror OLTP 1:1) so it runs on duckdb without a live DB. For the Postgres prod path, either (a) keep loading same-named seed tables, or (b) add a `source()`-based staging variant gated by target — a small follow-up; out of scope for the green-local build.
- After this, Superset datasets point at `mart.*` tables. Report (Mermaid DWH flow + ER) can cite these models.
