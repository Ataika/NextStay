# NextStay — Текущее состояние (снимок на 2026-06-12)

> Составлено по содержимому репозитория. Метки: ✅ есть в коде · 🟡 частично / требует проверки · ❌ отсутствует.
> «Есть в коде» ≠ «проверено, что работает» — сверять при доводке.

## Backend (Dair, но нужно для контекста DB)

**API endpoints** (`backend/app/api/v1/`) — присутствуют почти все по плану:
✅ `auth.py`, `rooms.py`, `bookings.py`, `holds.py`, `inventory_setup.py`, `guest.py`,
`tasks.py`, `staff.py`, `stripe.py`, `pricing_config.py`, `pricing_lab.py`,
`pricing_pipeline.py`, `training.py`, `health.py`
+ `IMPLEMENTATION.md`, `README.md` в той же папке.

`backend/app/core/`: `config.py`, `task_utils.py` (task state machine — ✅)
`backend/app/services/`: `email_service.py` (OTP delivery — ✅)
`backend/app/security/auth.py` (✅)

## Модели БД (Атай) — `backend/app/models/`

✅ `room.py`, `booking.py`, `guest_token.py`, `task.py` (CleaningTask), `user.py`,
`auth_session.py`, `email_otp.py`
🟡 `staff_members` / `staff_shifts` — отдельных model-файлов нет; есть SQL-миграции
(`scripts/migrate_add_staff_tables.sql`, `migrate_shift_types.sql`, `seed_staff_full.sql`)
→ проверить, как staff/shifts представлены в ORM vs raw SQL.

## Миграции (raw SQL)

`backend/migrations/`: `add_users_and_auth_sessions.sql`, `add_stripe_fields.sql`, `add_email_otps.sql`
`scripts/`: `init-db.sql`, `migrate_add_room_holds.sql`, `migrate_add_staff_tables.sql`,
`migrate_add_training_tables.sql`, `migrate_shift_types.sql`, `seed_cleaners.sql`, `seed_staff_full.sql`
🟡 Нужно собрать единый, упорядоченный список миграций и проверить, что создаются все 6 схем и все таблицы.

## Pricing Engine (`backend/priceengine/`) — продвинуто

✅ `src/`: `features.py`, `preprocessing.py`, `candidates.py`, `optimizer.py`, `rules.py`,
`price_engine.py`, `recommend_single_price.py`, `batch_runner.py`, `backtest_pricing.py`,
`compare_booking_models.py`, `promote_champion_model.py`, `monitor_pricing.py`, `ml_utils.py`
✅ `generate_synthetic_hotel_pricing.py` ([DB] синтетика S3 — есть)
✅ `load_postgres_pricing_seed.py`, `postgres_pricing_stack.py`, `minimal_stack_db.py`
✅ `minimal_site.py` — возможный задел под «примитивный сайт» (проверить)
✅ `artifacts/` — метаданные обученных моделей (random_forest, extra_trees, logreg, champion, global_booking_v1)
✅ `configs/` — feature_schema_v1, pricing_rules_v1, serving_config_v1
📄 `PROJECT_DOCUMENTATION.md`, `MINIMAL_STACK.md`

## DWH / dbt (`analytics/dbt/`) — ГЛАВНЫЙ ПРОБЕЛ Атая

🟡 `models/staging/`: только `stg_rooms.sql` + `sources.yml` (заготовка)
🟡 `models/example/`: дефолтные `my_first/second_dbt_model.sql` (мусор из init — убрать)
❌ `models/core/` (dim_hotels, dim_room_types, dim_dates, SCD) — **не построено**
❌ `models/mart/` (occupancy, loyalty, RevPAR) — **не построено**
❌ `seeds/`, `snapshots/`, `tests/` — пусто
✅ `dbt_project.yml`, `profiles.yml`, `Dockerfile.dbt`

## BI / Superset

✅ `analytics/superset/superset.db` (+ копия в `backup_before_merge/`)
🟡 Дашборды/датасеты — проверить, что подключены к mart-схеме (которой пока нет).

## Orchestration / Airflow

🟡 В README заявлен Airflow; DAG-файлы пока не обнаружены в дереве — проверить.

## Seed / синтетические данные

✅ `scripts/seed/`: `generate_test_dataset.py`, `seed_live_inventory_demo.py`, `seed.sql`,
`seed_db.sh`, `seed_pricing_engine.sh`, `api/`
✅ `scripts/data/`: `export_db.sh`, `import_db.sh`
✅ `backend/mock_data.json`

## Документация

`docs/`: `srs.md`, `architecture.md`, `PROJECT_STRUCTURE.md`, `PROJECT_FEATURES.md`,
`frontend-backend-integration.md`, `PRICEENGINE_INTEGRATION_REPORT.md`, `PERHOTEL_TRAINING.md`,
`STRIPE_SETUP.md`, `LOCAL_SETUP.md`, `HOW_TO_BOOK.md`, `WORKFLOW.md`, `TROUBLESHOOTING.md`,
`CONTRIBUTING.md`, `MERGE_DEV_NOTES.md`
`docs/diagrams/`: `Database_schema.pdf`, `database_schema.md`

---

## Главные пробелы (приоритеты Атая)

1. **DWH в dbt** — построить `core` (dims + SCD) и `mart` (occupancy, loyalty, RevPAR). Сейчас почти пусто.
2. **Симулятор синхронизации отелей** (новая задача) + опц. примитивный сайт бронирования.
3. **Чистота схемы/миграций** — единый упорядоченный набор, проверка всех 6 схем и FK/индексов.
4. **Airflow DAGs** — оркестрация ELT (если требуется по отчёту).
5. **Документация DB-части для отчёта** (160+ стр.) с диаграммами Mermaid.
