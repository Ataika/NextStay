# Hotel Sync — Phase 1: Multi-Hotel DB Foundation — Implementation Plan

> **Implementation:** follow tasks step by step. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ввести реестр отелей (`hotels`) и привязку `rooms.hotel_id`, чтобы синхронизация перестала быть single-hotel — фундамент для варианта A.

**Architecture:** Аддитивно к существующему one-way коду. Новая ORM-модель `Hotel` (тестируется на SQLite через `create_all`), nullable `rooms.hotel_id` с уникальностью `(hotel_id, number)`, raw-SQL миграция для PostgreSQL (создание `hotels`, backfill, FK на существующие sync-таблицы, seed дефолтного отеля), endpoints реестра в `hotel_sync.py`. Существующие вызовы с `hotelId=1` продолжают работать (seed-отель id=1).

**Tech Stack:** FastAPI, SQLAlchemy 2.0, PostgreSQL 15 (prod) / SQLite in-memory (tests), pytest + TestClient.

**Связанная спека:** `docs/superpowers/specs/2026-06-12-hotel-sync-simulator-design.md` (§5, §12).

---

## File Structure

- Create: `backend/app/models/hotel.py` — ORM-модель `Hotel`.
- Modify: `backend/app/models/__init__.py` — регистрация `Hotel`.
- Modify: `backend/app/models/room.py` — `hotel_id` + `UNIQUE(hotel_id, number)`.
- Create: `scripts/migrate_add_hotels.sql` — миграция PostgreSQL (hotels, backfill, FK, seed).
- Modify: `backend/app/api/v1/hotel_sync.py` — endpoints реестра `POST/GET /hotel-sync/hotels` + Pydantic-схемы + валидация существования отеля в `create_event_record`.
- Modify: `backend/tests/conftest.py` — импорт модели `Hotel`, override `hotel_sync.get_db`, хелпер `make_hotel`.
- Create: `backend/tests/test_hotels.py` — тесты реестра и мульти-отельной уникальности номеров.

---

## Task 1: ORM-модель Hotel

**Files:**
- Create: `backend/app/models/hotel.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_hotels.py`

- [ ] **Step 1: Написать падающий тест (модель регистрируется и создаётся в БД)**

Создать `backend/tests/test_hotels.py`:

```python
def test_hotel_model_persists(db):
    from app.models.hotel import Hotel

    hotel = Hotel(
        code="GRAND_BISHKEK",
        name="Grand Bishkek",
        webhook_url="http://hotelsim:8090/webhook",
        hmac_secret="secret-123",
        active=True,
    )
    db.add(hotel)
    db.commit()
    db.refresh(hotel)

    assert hotel.id is not None
    assert hotel.code == "GRAND_BISHKEK"
    assert hotel.active is True
    assert hotel.created_at is not None
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `cd backend && python -m pytest tests/test_hotels.py::test_hotel_model_persists -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.hotel'`

- [ ] **Step 3: Создать модель `backend/app/models/hotel.py`**

```python
from app.db.base import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.sql import func


class Hotel(Base):
    __tablename__ = "hotels"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    webhook_url = Column(String(500), nullable=True)
    hmac_secret = Column(String(255), nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 4: Зарегистрировать модель в `backend/app/models/__init__.py`**

Добавить импорт и в `__all__`:

```python
from app.models.hotel import Hotel
```
И добавить `"Hotel"` в список `__all__`.

- [ ] **Step 5: Зарегистрировать модель в тестовом окружении — `backend/tests/conftest.py`**

После строки `from app.models import guest_token as _gt_mod  # noqa: F401` добавить:

```python
from app.models import hotel as _hotel_mod  # noqa: F401
```

- [ ] **Step 6: Запустить тест — убедиться, что проходит**

Run: `cd backend && python -m pytest tests/test_hotels.py::test_hotel_model_persists -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/hotel.py backend/app/models/__init__.py backend/tests/conftest.py backend/tests/test_hotels.py
git commit -m "feat(db): add Hotel ORM model (multi-hotel registry foundation)"
```

---

## Task 2: rooms.hotel_id + уникальность (hotel_id, number)

**Files:**
- Modify: `backend/app/models/room.py`
- Modify: `backend/tests/conftest.py` (хелпер `make_hotel`, обновить `make_room`)
- Test: `backend/tests/test_hotels.py`

- [ ] **Step 1: Написать падающий тест — один и тот же номер в двух отелях разрешён, дубль в одном — нет**

Добавить в `backend/tests/test_hotels.py`:

```python
import pytest
from sqlalchemy.exc import IntegrityError


def test_same_room_number_allowed_across_hotels(db):
    from app.models.hotel import Hotel
    from app.models.room import Room

    h1 = Hotel(code="H1", name="Hotel One")
    h2 = Hotel(code="H2", name="Hotel Two")
    db.add_all([h1, h2])
    db.commit()

    db.add(Room(number="101", category="Standard", status="Available", price=100.0, capacity=2, hotel_id=h1.id))
    db.add(Room(number="101", category="Standard", status="Available", price=100.0, capacity=2, hotel_id=h2.id))
    db.commit()  # не должно падать — номер 101 в разных отелях

    rooms = db.query(Room).filter(Room.number == "101").all()
    assert len(rooms) == 2


def test_duplicate_room_number_within_hotel_rejected(db):
    from app.models.hotel import Hotel
    from app.models.room import Room

    h1 = Hotel(code="H1", name="Hotel One")
    db.add(h1)
    db.commit()

    db.add(Room(number="101", category="Standard", status="Available", price=100.0, capacity=2, hotel_id=h1.id))
    db.commit()
    db.add(Room(number="101", category="Standard", status="Available", price=100.0, capacity=2, hotel_id=h1.id))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd backend && python -m pytest tests/test_hotels.py -k room_number -v`
Expected: FAIL — `TypeError: 'hotel_id' is an invalid keyword argument for Room` (либо first test падает на глобальном UNIQUE number).

- [ ] **Step 3: Обновить модель `backend/app/models/room.py`**

Заменить весь файл на:

```python
from app.db.base import Base
from sqlalchemy import (
    JSON,
    Column,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("hotel_id", "number", name="uq_rooms_hotel_number"),)

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=True, index=True)
    number = Column(String(10), nullable=False, index=True)
    category = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="Available")
    price = Column(Float, nullable=False)
    capacity = Column(Integer, nullable=False, default=2)
    description = Column(Text, nullable=True)
    amenities = Column(JSON, nullable=True)  # Use JSON instead of ARRAY for compatibility
```

Примечание: глобальный `unique=True` с `number` снят (был бы конфликт при одинаковых номерах в разных отелях); уникальность теперь составная.

- [ ] **Step 4: Добавить хелпер `make_hotel` и обновить `make_room` в `backend/tests/conftest.py`**

В конец секции «Shared helpers» добавить:

```python
def make_hotel(db, code="DEFAULT", name="Default Hotel", webhook_url=None, hmac_secret="test-secret"):
    from app.models.hotel import Hotel

    hotel = Hotel(code=code, name=name, webhook_url=webhook_url, hmac_secret=hmac_secret, active=True)
    db.add(hotel)
    db.commit()
    db.refresh(hotel)
    return hotel
```

Обновить `make_room`, добавив параметр `hotel_id` (по умолчанию None — обратная совместимость существующих тестов):

```python
def make_room(db, number="101", price=100.0, status="Available", hotel_id=None):
    from app.models.room import Room

    room = Room(
        number=number,
        category="Standard",
        status=status,
        price=price,
        capacity=2,
        hotel_id=hotel_id,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room
```

- [ ] **Step 5: Запустить новые + регрессию по существующим room/booking тестам**

Run: `cd backend && python -m pytest tests/test_hotels.py tests/test_bookings.py -v`
Expected: PASS (новые тесты зелёные; `test_bookings.py` не сломан — `hotel_id` nullable).

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/room.py backend/tests/conftest.py backend/tests/test_hotels.py
git commit -m "feat(db): scope room number uniqueness per hotel (rooms.hotel_id)"
```

---

## Task 3: Endpoints реестра отелей (POST/GET /hotel-sync/hotels)

**Files:**
- Modify: `backend/app/api/v1/hotel_sync.py`
- Modify: `backend/tests/conftest.py` (override `hotel_sync.get_db`)
- Test: `backend/tests/test_hotels.py`

- [ ] **Step 1: Включить hotel_sync в override get_db — `backend/tests/conftest.py`**

В строке импорта роутеров добавить `hotel_sync`:

```python
from app.api.v1 import auth, bookings, chat, hotel_profile, hotel_sync, rooms, staff, tasks  # noqa: E402
```
И добавить `hotel_sync` в кортеж цикла override:

```python
for module in (auth, bookings, rooms, tasks, hotel_profile, staff, chat, hotel_sync):
    app.dependency_overrides[module.get_db] = override_get_db
```

- [ ] **Step 2: Написать падающий тест — регистрация и список отелей, отказ на дубль кода**

Добавить в `backend/tests/test_hotels.py`:

```python
from tests.conftest import login_owner, make_owner


def test_register_and_list_hotels(client, db):
    make_owner(db)
    token = login_owner(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(
        "/api/v1/hotel-sync/hotels",
        headers=headers,
        json={
            "code": "GRAND_BISHKEK",
            "name": "Grand Bishkek",
            "webhookUrl": "http://hotelsim:8090/webhook",
            "hmacSecret": "secret-123",
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["code"] == "GRAND_BISHKEK"

    listed = client.get("/api/v1/hotel-sync/hotels", headers=headers)
    assert listed.status_code == 200
    codes = [h["code"] for h in listed.json()]
    assert "GRAND_BISHKEK" in codes


def test_register_duplicate_hotel_code_rejected(client, db):
    make_owner(db)
    token = login_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    body = {"code": "DUP", "name": "Dup Hotel"}

    first = client.post("/api/v1/hotel-sync/hotels", headers=headers, json=body)
    assert first.status_code == 201, first.text
    second = client.post("/api/v1/hotel-sync/hotels", headers=headers, json=body)
    assert second.status_code == 409
```

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `cd backend && python -m pytest tests/test_hotels.py -k hotel -v`
Expected: FAIL — 404 (эндпоинта `/hotel-sync/hotels` ещё нет).

- [ ] **Step 4: Добавить схемы и эндпоинты в `backend/app/api/v1/hotel_sync.py`**

Добавить импорт модели рядом с другими импортами моделей:

```python
from app.models.hotel import Hotel as HotelModel
```

Добавить Pydantic-схемы после класса `HotelChannelBookingLog`:

```python
class HotelRegisterRequest(BaseModel):
    code: str
    name: str
    webhookUrl: str | None = None
    hmacSecret: str | None = None
    active: bool = True


class HotelResponse(BaseModel):
    id: int
    code: str
    name: str
    webhookUrl: str | None
    active: bool
```

Добавить эндпоинты после `list_channel_bookings`:

```python
@router.post("/hotel-sync/hotels", response_model=HotelResponse, status_code=201)
def register_hotel(
    payload: HotelRegisterRequest,
    db: Annotated[Session, Depends(get_db)],
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR")),
):
    existing = db.query(HotelModel).filter(HotelModel.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=409, detail="Hotel code already registered.")
    hotel = HotelModel(
        code=payload.code,
        name=payload.name,
        webhook_url=payload.webhookUrl,
        hmac_secret=payload.hmacSecret,
        active=payload.active,
    )
    db.add(hotel)
    db.commit()
    db.refresh(hotel)
    return HotelResponse(
        id=hotel.id,
        code=hotel.code,
        name=hotel.name,
        webhookUrl=hotel.webhook_url,
        active=hotel.active,
    )


@router.get("/hotel-sync/hotels", response_model=list[HotelResponse])
def list_hotels(
    db: Annotated[Session, Depends(get_db)],
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    hotels = db.query(HotelModel).order_by(HotelModel.id).all()
    return [
        HotelResponse(
            id=h.id,
            code=h.code,
            name=h.name,
            webhookUrl=h.webhook_url,
            active=h.active,
        )
        for h in hotels
    ]
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `cd backend && python -m pytest tests/test_hotels.py -k hotel -v`
Expected: PASS

- [ ] **Step 6: Полный прогон backend-тестов (регрессия)**

Run: `cd backend && python -m pytest -q`
Expected: все тесты PASS (включая test_auth/test_bookings/test_staff/test_tasks/test_chat).

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/v1/hotel_sync.py backend/tests/conftest.py backend/tests/test_hotels.py
git commit -m "feat(api): hotel registry endpoints (POST/GET /hotel-sync/hotels)"
```

---

## Task 4: PostgreSQL-миграция (hotels, backfill, FK, seed)

**Files:**
- Create: `scripts/migrate_add_hotels.sql`

> Эта миграция выполняется против PostgreSQL (prod/dev), не в тестах (тесты на SQLite используют `create_all`). Проверяется ручным прогоном; SQL должен проходить sqlfluff.

- [ ] **Step 1: Создать `scripts/migrate_add_hotels.sql`**

```sql
-- Migration: add hotel registry and link rooms/sync tables to it.
-- Run once against an existing database. Idempotent where possible.

CREATE TABLE IF NOT EXISTS public.hotels (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    webhook_url VARCHAR(500),
    hmac_secret VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed a default hotel as id = 1 so existing single-hotel rows map to it.
INSERT INTO public.hotels (id, code, name, active)
VALUES (1, 'DEFAULT', 'Default Hotel', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Link rooms to a hotel.
ALTER TABLE public.rooms
    ADD COLUMN IF NOT EXISTS hotel_id INTEGER REFERENCES public.hotels (id);

UPDATE public.rooms
SET hotel_id = 1
WHERE hotel_id IS NULL;

-- Replace global room-number uniqueness with per-hotel uniqueness.
ALTER TABLE public.rooms
    DROP CONSTRAINT IF EXISTS rooms_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rooms_hotel_number
    ON public.rooms (hotel_id, number);

-- Tie existing sync tables to the registry (created by migrate_add_hotel_sync.sql).
ALTER TABLE public.hotel_sync_events
    ADD CONSTRAINT fk_hotel_sync_events_hotel
    FOREIGN KEY (hotel_id) REFERENCES public.hotels (id);

ALTER TABLE public.hotel_channel_bookings
    ADD CONSTRAINT fk_hotel_channel_bookings_hotel
    FOREIGN KEY (hotel_id) REFERENCES public.hotels (id);
```

- [ ] **Step 2: Проверить SQL линтером (тот же, что в pre-commit)**

Run: `sqlfluff lint scripts/migrate_add_hotels.sql --dialect postgres`
Expected: `All Finished!` без нарушений (если есть — поправить отступы/пробелы и перезапустить).

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate_add_hotels.sql
git commit -m "feat(db): migration for hotels registry, rooms.hotel_id, sync FKs"
```

> Примечание: `ADD CONSTRAINT` для FK не идемпотентен между запусками; при повторном применении обернуть в `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; $$` либо запускать на чистой БД. Для учебного демо достаточно одного прогона на свежей БД (`scripts/init-db.sql` → миграции).

---

## Self-Review (выполнено при написании)

- **Покрытие спеки §12 дельта-пункты 1–2:** реестр `hotels` (Task 1,3,4) и мульти-отель в `rooms` (Task 2,4) — покрыты. Пункты 3–6 (HMAC, обратный webhook, hotelsim, origin/revision) — вынесены в Phase 2/3.
- **Плейсхолдеры:** нет — весь код приведён.
- **Согласованность типов:** `HotelModel`/`Hotel`, поля `webhook_url`↔`webhookUrl`, `hmac_secret`↔`hmacSecret` согласованы между моделью, схемами и тестами.
- **Тестируемость на SQLite:** `Hotel` — ORM-модель (создаётся `create_all`), все Phase-1 тесты не требуют JSONB/Postgres. Миграция (Task 4) проверяется отдельно линтером, не в pytest.

## Что НЕ входит в Phase 1 (следующие планы)

- **Phase 2:** HMAC-подпись inbound (заменяет/дополняет общий токен), валидация `hotel_id` против реестра в `create_event_record`, колонки `origin`/`revision` в `hotel_sync_events`, анти-эхо, исходящий `sync_publisher` (PMS→отель) с тестами через мок httpx.
- **Phase 3:** отдельный сервис `hotelsim/` (FastAPI + vanilla мини-сайт + SQLite-стор N отелей + `POST /webhook` + генератор трафика + исходящие подписанные вызовы) и его подключение в `docker-compose` (порт 8090), e2e-демо.
