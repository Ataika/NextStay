# E2E Demo — Hotel Sync (Postgres) + DWH

Сквозной сценарий двусторонней синхронизации PMS ↔ внешний сайт отеля, на живом Postgres,
плюс прогон DWH (dbt) на prod-таргете. Демонстрирует работу Phases 1–3 и витрин.

## Предусловия
- Docker Desktop запущен (`open -a Docker`).
- Порты свободны: 5433 (db), 8000 (backend), 8090 (hotelsim), 5173 (frontend), 8080/8088 (airflow/superset).

## 0. Свежая инициализация — один шаг (исправлено)

Свежий `docker compose up` поднимается БЕЗ ручных шагов: `scripts/init-db.sql` на чистом томе создаёт
`hotels` (+seed id=1, привязан к webhook симулятора), `rooms.hotel_id` + `UNIQUE(hotel_id, number)`
(+seed номеров 101/102/201 для отеля 1), `origin/revision` на `hotel_sync_events` и FK на `hotels`.
`users`/`auth_sessions` намеренно не создаются в init-db — их строит backend `create_all` (все колонки)
+ сидит миграция `backend/migrations/add_users_and_auth_sessions.sql` (admin/staff/lizett).

> Ранее на чистом томе backend падал (`UndefinedColumn` на сид users с `preferred_language`/
> `failed_login_attempts`, которых не было в устаревшей `users` из init-db). Исправлено коммитом
> «fresh-init one-shot». Для УЖЕ существующих БД (старый том) — применить
> `scripts/migrate_add_hotels.sql` + `migrate_add_sync_origin.sql` вручную (см. ниже).

## 1. Поднять стек
```bash
cd ~/Desktop/NextStay-hotel-sync
docker compose up -d --build db backend hotelsim
docker compose ps        # дождаться healthy у db, up у backend/hotelsim
```
> Backend на старте применяет миграции (`prepare_database`) — таблицы `hotels`, `rooms.hotel_id`,
> `hotel_sync_events`, `hotel_channel_bookings`. Убедиться, что seed-отель `id=1` есть
> (миграция `scripts/migrate_add_hotels.sql`), иначе выполнить миграции вручную.

## 2. Конфиг авторизации синхронизации
Два режима приёма событий PMS (`/api/v1/hotel-sync/events`):
- **Токен (по умолчанию):** `HOTEL_SYNC_HMAC_ENABLED=false`, общий `HOTEL_SYNC_TOKEN=dev-hotel-sync-token`.
  hotelsim шлёт `X-Hotel-Sync-Token` — совпадает из коробки.
- **HMAC (продакшн-режим):** в `backend/.env` выставить `HOTEL_SYNC_HMAC_ENABLED=true`; у зарегистрированного
  отеля `hmac_secret` должен совпадать с `HOTELSIM_HMAC_SECRET` (по умолчанию `dev-hotel-hmac-secret`).
  hotelsim уже шлёт `X-NextStay-Signature` всегда.

## 3. Подготовка данных в PMS
Админ-эндпоинты принимают dev-токен `Authorization: Bearer mock-admin-token`
(при `DEV_OWNER_TOKEN_ENABLED=true`).

```bash
PMS=http://localhost:8000/api/v1
AUTH='Authorization: Bearer mock-admin-token'

# 3.1 зарегистрировать отель (webhook указывает на hotelsim — обратная синхронизация)
curl -s -X POST $PMS/hotel-sync/hotels -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "code":"GRAND_BISHKEK","name":"Grand Bishkek",
  "webhookUrl":"http://hotelsim:8090/webhook","hmacSecret":"dev-hotel-hmac-secret"
}'

# 3.2 создать в PMS номер с hotelId=1 и номером, который есть на сайте отеля (101)
curl -s -X POST $PMS/rooms -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "number":"101","category":"Standard","status":"Available","price":100,"capacity":2,"hotelId":1
}'
```

## 4. Сценарий синхронизации

**A. Бронь на сайте отеля → видно в PMS**
```bash
# забронировать 101 на мини-сайте отеля (hotelsim → подписанное событие → PMS)
curl -s -X POST http://localhost:8090/api/book -H 'Content-Type: application/json' -d '{
  "roomNumber":"101","guestName":"E2E Guest","guestEmail":"e2e@example.com",
  "checkIn":"2026-08-01T14:00:00Z","checkOut":"2026-08-03T12:00:00Z","amountPaid":200
}'
# проверить в PMS: появилась бронь + маппинг канала
curl -s $PMS/hotel-sync/channel-bookings -H "$AUTH"   # status=active, external_booking_id=hsim-...
curl -s $PMS/bookings -H "$AUTH"                       # бронь гостя E2E Guest, номер 101
```
Ожидание: в PMS есть бронь (Upcoming/Checked-in), `rooms.status` для 101 → Occupied (если даты текущие),
запись в `hotel_sync_events` (status=processed) и `hotel_channel_bookings` (active).

**B. Отмена в PMS → видно на сайте отеля**
```bash
# взять booking_id из шага A, отменить в PMS (admin)
BID=<booking_id>
curl -s -X PATCH $PMS/bookings/$BID -H "$AUTH" -H 'Content-Type: application/json' -d '{"status":"Cancelled"}'
# PMS publisher шлёт подписанный webhook на hotelsim → локальная бронь отменяется
curl -s http://localhost:8090/api/bookings    # та же бронь со status=cancelled
curl -s http://localhost:8090/api/events      # запись о входящем booking_cancelled
```
Ожидание: на сайте отеля бронь → `cancelled`; гостевой токен в PMS инвалидирован; номер освобождён.

**C. (опц.) Живой трафик** — генератор hotelsim периодически создаёт/отменяет брони
(см. `hotelsim/generator.py`), наблюдать поток в `hotel_sync_events`.

## 5. DWH на prod-Postgres (dbt)
```bash
# из контейнера dbt или локально с postgres-таргетом:
export DBT_PG_HOST=localhost DBT_PG_PORT=5433 DBT_PG_USER=nextstay DBT_PG_PASS=nextstay DBT_PG_DBNAME=nextstay
analytics/.dbt-venv/bin/dbt build \
  --project-dir analytics/dbt --profiles-dir analytics/dbt --target postgres
```
> Примечание: текущие staging-модели читают из dbt **seeds** (для локальной DuckDB-проверки).
> Для prod-варианта «из живого OLTP» — переключить staging на `{{ source(...) }}` к `public.*`
> (мелкий follow-up; см. план DWH, раздел Notes).

## 6. Airflow (оркестрация ELT)
- DAG `nextstay_dbt_elt` (`analytics/dags/dbt_elt_dag.py`): `dbt seed → run → snapshot → test` на postgres-таргете, ночью в 03:00.
- Airflow ставит dbt на старте (`_PIP_ADDITIONAL_REQUIREMENTS=dbt-postgres`), подключается к `db:5432` через `DBT_PG_*`.
- Запуск разово: `docker exec nextstay_airflow airflow dags test nextstay_dbt_elt 2026-08-01` (все таски SUCCESS, dbt-тесты PASS). UI: http://localhost:8080.

## 7. Superset (дашборды)
- Образ собирается с драйвером Postgres (`analytics/superset/Dockerfile` — psycopg2-binary; базовый образ его не содержит).
- Инициализация (один раз): `docker exec nextstay_superset superset db upgrade && ... fab create-admin ... && ... superset init`.
- Бутстрап подключения/датасетов/чартов/дашборда: `python scripts/bootstrap_superset.py` (идемпотентно).
  Создаёт: connection «NextStay Warehouse» → datasets `stg_mart.mart_occupancy/мart_revpar/mart_loyalty` → 3 чарта → дашборд «NextStay — Hotel Analytics» с раскладкой.
- UI: http://localhost:8088 (admin/admin) → Dashboards → NextStay — Hotel Analytics.

## Критерии успеха
- [ ] Бронь с сайта отеля появляется в PMS (`bookings` + `hotel_channel_bookings.active`)
- [ ] `hotel_sync_events` фиксирует событие со `status=processed`
- [ ] Отмена в PMS отражается на сайте отеля (`/api/bookings` → cancelled)
- [ ] Повторная отправка того же `eventId` → идемпотентно (skipped), без дубля брони
- [ ] (HMAC-режим) событие с неверной подписью → 401
- [ ] dbt `build --target postgres` — зелёный
