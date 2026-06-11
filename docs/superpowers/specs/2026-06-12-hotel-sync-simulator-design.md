# Hotel Sync Simulator — Design Spec

**Дата:** 2026-06-12
**Автор:** Atai (DB / Data Architecture)
**Проект:** NextStay PMS
**Статус:** утверждён (вариант A)

## 1. Цель

Продемонстрировать двустороннюю синхронизацию между внешними «сайтами отелей» и нашим PMS:
бронь, созданная на стороне отеля, появляется у нас; изменение, сделанное в PMS, уходит обратно отелю.
Сценарий — централизованная система бронирования / channel manager для **нескольких отелей**.

Это новая задача поверх существующего проекта; основная нагрузка спринтов 2–5 уже выполнена.
Зона ответственности — БД-часть (схема, миграции, реестр отелей, журнал событий) + тонкий integration-слой.

## 2. Решения (утверждены)

| Вопрос | Решение |
|---|---|
| Мульти-отель | Да — вводим `hotel_id`, несколько источников-отелей со своим инвентарём (стыкуется с `dim_hotels`) |
| Направление | Двусторонняя: HOTEL→PMS и PMS→HOTEL, с защитой от эхо-петель |
| Транспорт | Webhook (HTTP POST) + подпись HMAC-SHA256 |
| Мини-сайт отеля | Да — примитивный vanilla HTML/JS (внешний сайт, не наш продукт) |
| Архитектура | Вариант A: отдельный сервис Hotel Simulator + реестр отелей в PMS |

## 3. Архитектура

```mermaid
flowchart LR
  subgraph SIM["Hotel Simulator (hotelsim/, порт 8090)"]
    SITE["Мини-сайт отеля<br/>(HTML/JS: выбор номера, бронь)"]
    SIMDB[("SQLite<br/>инвентарь N отелей")]
    GEN["Генератор трафика<br/>(фоновые брони/отмены)"]
    SIMIN["POST /webhook<br/>(приём PMS-событий)"]
  end
  subgraph PMS["NextStay PMS (FastAPI + PostgreSQL)"]
    SYNCIN["POST /api/v1/sync/events<br/>(приём, HMAC, дедуп)"]
    SVC["sync_service<br/>(upsert + reconcile)"]
    PUB["sync_publisher<br/>(исходящие webhook)"]
    OLTP[("public: hotels, rooms,<br/>bookings, sync_events")]
  end
  SITE --> SIMDB
  GEN --> SIMDB
  SIMDB -->|"booking.created/cancelled (HMAC)"| SYNCIN
  SYNCIN --> SVC --> OLTP
  OLTP -->|"PMS-origin изменения"| PUB -->|"webhook + HMAC"| SIMIN --> SIMDB
```

## 4. Компоненты

### 4.1 PMS Sync (наш backend)
- `app/api/v1/sync.py` — роутер:
  - `POST /api/v1/sync/events` — входящий webhook от отелей (проверка HMAC, дедуп, апсерт).
  - `GET /api/v1/sync/events` — аудит-лог событий (для админки/отчёта).
  - `POST /api/v1/sync/hotels` — регистрация отеля (code, name, webhook_url, secret).
- `app/services/sync_service.py` — валидация подписи, дедуп по `event_id`, апсерт брони/статуса номера по `(hotel_id, external_ref)`, проверка овербукинга, простановка статусов.
- `app/services/sync_publisher.py` — отправка исходящих событий на `hotels.webhook_url` (только для `origin=PMS`).

### 4.2 Hotel Simulator (`hotelsim/`)
- Мини-сайт: vanilla HTML/JS — список номеров отеля, выбор дат, кнопка «Забронировать», текущий статус. Без сборки/auth.
- Стор: SQLite с инвентарём нескольких отелей.
- `POST /webhook` — приём PMS-событий → обновление своего стора.
- Генератор трафика — фоновая задача: случайные брони/отмены для живой демонстрации.
- Исходящие: при брони/отмене на симе — подпись HMAC + `POST` на PMS `/sync/events`.

## 5. Модель данных (OLTP `public`)

### Новые таблицы
**`hotels`**

| Поле | Тип | Назначение |
|---|---|---|
| id | serial PK | |
| code | varchar uniq | код отеля (напр. `GRAND_BISHKEK`) |
| name | varchar | |
| webhook_url | varchar | куда PMS шлёт исходящие события |
| hmac_secret | varchar | общий секрет для подписи |
| active | bool | |
| created_at | timestamptz | |

→ питает `core.dim_hotels`.

**`sync_events`**

| Поле | Тип | Назначение |
|---|---|---|
| id | serial PK | |
| event_id | uuid uniq | идемпотентность |
| direction | varchar | inbound / outbound |
| hotel_id | int FK→hotels | |
| event_type | varchar | booking.created/updated/cancelled, room.status_changed |
| entity_type | varchar | booking / room |
| external_ref | varchar | id сущности на стороне отеля |
| origin | varchar | HOTEL / PMS |
| payload | jsonb | сырое тело события |
| status | varchar | received / processed / failed / skipped |
| error | text | |
| created_at | timestamptz | |
| processed_at | timestamptz | |

### Изменения существующих
- `rooms`: + `hotel_id` int FK, + `external_ref` varchar; уникальность `number` → **`UNIQUE(hotel_id, number)`**.
- `bookings`: + `hotel_id` int FK, + `source` varchar ('HOTEL_SITE'/'PMS'), + `external_ref` varchar, + `revision` int default 0.

Реализация: raw-SQL миграции (как в проекте) + обновление SQLAlchemy-моделей.
Бонус DWH: `sync_events` → витрина «производительность каналов» (mart).

## 6. Контракт события

```json
{
  "event_id": "uuid",
  "occurred_at": "2026-06-12T10:00:00Z",
  "type": "booking.created | booking.updated | booking.cancelled | room.status_changed",
  "origin": "HOTEL | PMS",
  "hotel_code": "GRAND_BISHKEK",
  "revision": 1,
  "data": {
    "external_ref": "hsim-bk-123",
    "room_number": "101",
    "guest_name": "...",
    "check_in": "2026-06-20T14:00:00Z",
    "check_out": "2026-06-22T12:00:00Z",
    "status": "Confirmed"
  }
}
```

**Безопасность:** `X-NextStay-Signature: sha256=<HMAC>` от сырого тела с `hotel.hmac_secret`.
Получатель пересчитывает и сравнивает constant-time → отвергает подделки/несоответствие.

## 7. Логика синхронизации

- **Идемпотентность:** дедуп по `event_id` (повтор → `skipped`).
- **Анти-эхо:** входящее `origin=HOTEL` применяется и **не** ре-публикуется; исходящие — только для `origin=PMS`.
- **Порядок:** `revision` — апдейт с `revision <= текущего` игнорируется.
- **Маппинг:** апсерт по `(hotel_id, external_ref)` ↔ `booking.id`.
- **Овербукинг:** пересечение дат на один номер из разных каналов → бронь помечается конфликтной (статус + запись в лог).
- **Статусы номера:** при активной брони на текущие даты `rooms.status` → Occupied; при отмене → Available (если нет других активных броней).

## 8. Тестирование

**Unit:**
- проверка/отклонение HMAC-подписи;
- дедуп по `event_id`;
- апсерт-реконсиляция booking по `(hotel_id, external_ref)`;
- анти-эхо: inbound HOTEL-событие не триггерит outbound;
- игнор устаревшего `revision`.

**Integration (FastAPI TestClient):**
- бронь на симе → появляется в PMS (статус номера обновлён);
- отмена в PMS → отражается на симе;
- двойная бронь одного номера на пересекающиеся даты → конфликт/овербукинг.

## 9. Развёртывание и демо

- `hotelsim` — отдельный сервис в `docker-compose` (порт 8090); env: `PMS_URL`, секреты отелей.
- Демо: `docker compose up` → мини-сайт → бронь → админка PMS (занято) → отмена в PMS (обновилось на сайте) → генератор (живой трафик) → лог `sync_events`.

## 10. Границы (YAGNI)

- Мини-сайт примитивный (vanilla, без сборки/auth).
- Очередь/ретраи с backoff — не делаем (at-least-once + идемпотентность); ретраи → future work.
- Авторизация на симе не требуется.

## 11. Материал для отчёта

ER-добавления, sequence-диаграммы (inbound/outbound), HMAC-безопасность, идемпотентность, анти-эхо,
конфликты/овербукинг, витрина каналов в DWH. Раздел отчёта № 10 «Hotel Sync Simulator».

## 12. Базис реализации — РАСШИРЯЕМ существующий код (решение 0002)

В дереве уже есть рабочая **one-way single-hotel** реализация — её НЕ выбрасываем, а наращиваем до A.

### Что уже есть и переиспользуем как есть
- `backend/app/api/v1/hotel_sync.py`: `POST /api/v1/hotel-sync/events` (приём), `GET /hotel-sync/events`, `GET /hotel-sync/channel-bookings`.
- Идемпотентность: `hotel_sync_events.external_event_id UNIQUE` + `ON CONFLICT DO NOTHING`.
- Журнал событий `hotel_sync_events` + маппинг `hotel_channel_bookings` (UNIQUE `(hotel_id, external_booking_id)`).
- Обработчики: `booking_created` (овербукинг-чек, guest token, статус номера), `booking_cancelled` (инвалидация токена, освобождение номера), `room_status_updated`.
- Аутентификация: общий токен `X-Hotel-Sync-Token` (`HOTEL_SYNC_TOKEN`).
- Скрипт `scripts/simulate_hotel_site_booking.py`, фронт `HotelSiteSimulatorPage.tsx`.

> Примечание: в коде типы событий `booking_created/booking_cancelled/room_status_updated` (snake_case) — сохраняем эти имена ради совместимости (спека в §6 показывала dotted-нотацию как идею; **источник истины — текущий код**).

### Дельта до варианта A (что добавляем)
1. **Реестр отелей** — таблица `hotels` (code, name, webhook_url, hmac_secret, active). FK `hotel_sync_events.hotel_id` / `hotel_channel_bookings.hotel_id` → `hotels.id`; убрать `DEFAULT 1`, валидировать существование отеля.
2. **Мульти-отель в поиске номеров** — `find_room` сейчас ищет `Room.number` глобально; искать по `(hotel_id, number)`. (`hotel_id` в `rooms` + `UNIQUE(hotel_id, number)` уже сделаны в Phase 1.) **Carry-over из ревью Phase 1:** `rooms.py` `create_room`/`update_room` тоже проверяют дубль `number` глобально — скоупить по `hotel_id`, иначе ложный 400 при втором отеле.
3. **HMAC** — заголовок `X-NextStay-Signature: sha256=<HMAC(raw_body, hotel.hmac_secret)>`, constant-time сравнение; общий токен оставить как fallback для dev.
4. **Обратная синхронизация PMS→отель** — `sync_publisher`: при изменениях с `origin=PMS` (отмена/чек-аут/смена статуса в админке) слать подписанный webhook на `hotels.webhook_url`. Анти-эхо: события, пришедшие как inbound (`origin=HOTEL`), не ре-публиковать; добавить колонку `origin` в `hotel_sync_events` и (опц.) `revision`.
5. **Сервис `hotelsim/`** — отдельное FastAPI-приложение: мини-сайт (vanilla HTML/JS), свой SQLite-стор на N отелей, `POST /webhook` (приём PMS-событий), фоновый генератор трафика, исходящие подписанные вызовы на PMS `/hotel-sync/events`. Сервис в `docker-compose` (порт 8090).
6. **Миграция** — расширить `scripts/migrate_add_hotel_sync.sql` (новые таблица `hotels`, колонки `origin`/`revision`, FK) и почистить sqlfluff-замечания (обходили `--no-verify`).

### Совместимость
- Все изменения аддитивны; существующие one-way вызовы продолжают работать (общий токен как fallback, `hotel_id` по умолчанию маппится на seed-отель).
