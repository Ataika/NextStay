# E2E Demo — Hotel Sync (Postgres) + DWH

Сквозной сценарий двусторонней синхронизации PMS ↔ внешний сайт отеля, на живом Postgres,
плюс прогон DWH (dbt) на prod-таргете. Демонстрирует работу Phases 1–3 и витрин.

## Предусловия
- Docker Desktop запущен (`open -a Docker`).
- Порты свободны: 5433 (db), 8000 (backend), 8090 (hotelsim), 5173 (frontend), 8080/8088 (airflow/superset).

## 0. ⚠️ Известная проблема свежей инициализации (до интеграции origin/latest)

На чистом томе backend падает на старте: `prepare_database()` сидит юзеров с колонками
(`preferred_language`, `failed_login_attempts`, …), которых нет в `users`, созданной устаревшим
`scripts/init-db.sql` → `UndefinedColumn`. Это пред-существующий баг main (его чинит «migration backfill»
в неинтегрированной ветке `origin/latest`). Обходной путь (проверено):
```bash
# пересоздать users/auth_sessions из ORM-моделей (create_all достроит все колонки)
docker exec nextstay_db_clean psql -U nextstay -d nextstay -c \
  "DROP TABLE IF EXISTS auth_sessions CASCADE; DROP TABLE IF EXISTS users CASCADE;"
docker restart nextstay_backend     # create_all + миграции применятся чисто
```
Затем применить схему hotel-sync (наши миграции из scripts/ не входят в bootstrap):
```bash
docker exec -i nextstay_db_clean psql -U nextstay -d nextstay < scripts/migrate_add_hotels.sql
docker exec -i nextstay_db_clean psql -U nextstay -d nextstay < scripts/migrate_add_sync_origin.sql
# задать webhook отелю id=1 (для обратной синхронизации) + секрет
docker exec nextstay_db_clean psql -U nextstay -d nextstay -c \
  "UPDATE hotels SET code='GRAND_BISHKEK', webhook_url='http://hotelsim:8090/webhook', hmac_secret='dev-hotel-hmac-secret' WHERE id=1;"
```
> TODO (с разрабами при интеграции origin/latest): свести `init-db.sql`/bootstrap так, чтобы свежий
> `docker compose up` поднимался без ручных шагов, и добавить `hotel_id`/`hotels`/origin-revision в init.

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

## Критерии успеха
- [ ] Бронь с сайта отеля появляется в PMS (`bookings` + `hotel_channel_bookings.active`)
- [ ] `hotel_sync_events` фиксирует событие со `status=processed`
- [ ] Отмена в PMS отражается на сайте отеля (`/api/bookings` → cancelled)
- [ ] Повторная отправка того же `eventId` → идемпотентно (skipped), без дубля брони
- [ ] (HMAC-режим) событие с неверной подписью → 401
- [ ] dbt `build --target postgres` — зелёный
