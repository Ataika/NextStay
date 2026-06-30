# Hotel Sync — Phase 2: HMAC + Bidirectional Sync — Implementation Plan

> **Implementation:** follow tasks step by step. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Поднять hotel-sync с one-way single-hotel до защищённой двусторонней мульти-отельной синхронизации: HMAC-подпись событий, валидация отеля по реестру, hotel-scoping поиска номеров, и обратный webhook PMS→отель с защитой от эхо-петель.

**Architecture:** Аддитивно к существующему `hotel_sync.py` (one-way inbound на таблицах `hotel_sync_events`/`hotel_channel_bookings`, созданных raw-SQL). Чистые юнит-функции (HMAC, anti-echo, envelope) тестируются без БД; hotel-scoping — на SQLite; полный inbound-флоу (JSONB) проверяется на Postgres/вручную. Анти-эхо обеспечивается разделением по call-site: inbound-запись (`hotel_sync.py`) НЕ публикует; outbound публикуется ТОЛЬКО из PMS-эндпоинтов (`bookings.py`) для броней, у которых есть запись-маппинг в `hotel_channel_bookings`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, PostgreSQL/SQLite(tests), pytest+TestClient, `hmac`/`hashlib` (stdlib), `httpx` (outbound).

**Спека:** `docs/superpowers/specs/2026-06-12-hotel-sync-simulator-design.md` (§4–§7, §12).
**Тест-команда:** `/Users/ataika/Desktop/NextStay-hotel-sync/backend/.venv/bin/python -m pytest /Users/ataika/Desktop/NextStay-hotel-sync/backend/tests --rootdir=/Users/ataika/Desktop/NextStay-hotel-sync/backend -p no:cacheprovider -q` (baseline: 85 passed).
**Среда:** sandbox ломает `cd`/`grep`/`find`; работать абсолютными путями, `git -C <repo>`, `git -C <repo> grep`.

---

## File Structure

- Create: `backend/app/core/hotel_sync_security.py` — чистые HMAC sign/verify.
- Create: `backend/app/services/sync_publisher.py` — построение/подпись/отправка outbound-событий + лог.
- Modify: `backend/app/core/config.py` — `HOTEL_SYNC_HMAC_ENABLED`.
- Modify: `backend/app/api/v1/hotel_sync.py` — hotel-scoping `find_room`; `origin` в событии/записи; HMAC-проверка inbound; helper anti-echo.
- Modify: `backend/app/api/v1/rooms.py` — duplicate-check с учётом `hotel_id`.
- Modify: `backend/app/api/v1/bookings.py` — outbound-публикация при PMS-инициированной отмене/чек-ауте брони-из-канала.
- Modify: `scripts/migrate_add_hotels.sql` (или новый `scripts/migrate_add_sync_origin.sql`) — колонки `origin`/`revision` на `hotel_sync_events`.
- Modify: `backend/tests/conftest.py` — SQLite-DDL для `hotel_channel_bookings` (для тестов outbound-хука).
- Create: `backend/tests/test_hotel_sync_security.py`, `backend/tests/test_sync_publisher.py`, `backend/tests/test_hotel_scoping.py`, `backend/tests/test_outbound_sync.py`.

---

## Task 1: HMAC sign/verify utility (pure)

**Files:** Create `backend/app/core/hotel_sync_security.py`; Test `backend/tests/test_hotel_sync_security.py`.

- [ ] **Step 1: Write failing tests** — `backend/tests/test_hotel_sync_security.py`:

```python
from app.core.hotel_sync_security import sign_payload, verify_signature


def test_sign_payload_is_deterministic_and_prefixed():
    sig = sign_payload(b'{"a":1}', "secret")
    assert sig.startswith("sha256=")
    assert sig == sign_payload(b'{"a":1}', "secret")


def test_verify_accepts_matching_signature():
    body = b'{"event":"x"}'
    sig = sign_payload(body, "secret")
    assert verify_signature(body, "secret", sig) is True


def test_verify_rejects_tampered_body():
    sig = sign_payload(b'{"event":"x"}', "secret")
    assert verify_signature(b'{"event":"y"}', "secret", sig) is False


def test_verify_rejects_wrong_secret():
    body = b'{"event":"x"}'
    sig = sign_payload(body, "secret")
    assert verify_signature(body, "other", sig) is False


def test_verify_rejects_garbage_or_missing_header():
    body = b'{"event":"x"}'
    assert verify_signature(body, "secret", "") is False
    assert verify_signature(body, "secret", "not-a-sig") is False
    assert verify_signature(body, "secret", None) is False
```

- [ ] **Step 2: Run — confirm FAIL** (`ModuleNotFoundError`).
Run: `…/.venv/bin/python -m pytest …/backend/tests/test_hotel_sync_security.py -q --rootdir=…/backend`

- [ ] **Step 3: Implement `backend/app/core/hotel_sync_security.py`:**

```python
"""HMAC-SHA256 signing/verification for hotel-sync webhook payloads.

Pure functions (no DB, no FastAPI) so they are trivially unit-testable.
The signature is computed over the RAW request body bytes, never the parsed
model, so re-serialization differences cannot break verification.
"""

import hashlib
import hmac

_PREFIX = "sha256="


def sign_payload(raw_body: bytes, secret: str) -> str:
    """Return 'sha256=<hexdigest>' for the given raw body and shared secret."""
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return f"{_PREFIX}{digest}"


def verify_signature(raw_body: bytes, secret: str, provided: str | None) -> bool:
    """Constant-time check that `provided` matches the signature of `raw_body`.

    Returns False for missing/malformed signatures instead of raising.
    """
    if not provided or not provided.startswith(_PREFIX):
        return False
    expected = sign_payload(raw_body, secret)
    return hmac.compare_digest(expected, provided)
```

- [ ] **Step 4: Run — confirm PASS.**
- [ ] **Step 5: Commit:**
```
git -C /Users/ataika/Desktop/NextStay-hotel-sync add backend/app/core/hotel_sync_security.py backend/tests/test_hotel_sync_security.py
git -C /Users/ataika/Desktop/NextStay-hotel-sync commit -m "feat(hotel-sync): HMAC sign/verify utility"
```

---

## Task 2: Hotel-scoping of room lookups

**Files:** Modify `backend/app/api/v1/hotel_sync.py` (`find_room`); Modify `backend/app/api/v1/rooms.py` (`create_room`, `update_room`); add `hotelId` to `RoomCreate`/`RoomUpdate` + expose in response; Test `backend/tests/test_hotel_scoping.py`.

- [ ] **Step 1: Write failing tests** — `backend/tests/test_hotel_scoping.py`:

```python
from tests.conftest import login_owner, make_hotel, make_owner, make_room


def test_create_room_same_number_different_hotel_allowed(client, db):
    make_owner(db)
    h1 = make_hotel(db, code="H1", name="H1")
    h2 = make_hotel(db, code="H2", name="H2")
    token = login_owner(client)
    headers = {"Authorization": f"Bearer {token}"}

    body = {"number": "101", "category": "Standard", "status": "Available", "price": 100, "capacity": 2}
    r1 = client.post("/api/v1/rooms", headers=headers, json={**body, "hotelId": h1.id})
    assert r1.status_code == 201, r1.text
    r2 = client.post("/api/v1/rooms", headers=headers, json={**body, "hotelId": h2.id})
    assert r2.status_code == 201, r2.text


def test_create_room_duplicate_number_same_hotel_rejected(client, db):
    make_owner(db)
    h1 = make_hotel(db, code="H1", name="H1")
    token = login_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    body = {"number": "101", "category": "Standard", "status": "Available", "price": 100, "capacity": 2, "hotelId": h1.id}

    assert client.post("/api/v1/rooms", headers=headers, json=body).status_code == 201
    assert client.post("/api/v1/rooms", headers=headers, json=body).status_code == 400
```

- [ ] **Step 2: Run — confirm FAIL** (currently second create in different hotel returns 400 because the check is global, or hotelId is ignored).

- [ ] **Step 3: Edit `backend/app/api/v1/rooms.py`:**

(a) Add `hotelId` to `RoomCreate` and `RoomUpdate`:
```python
class RoomCreate(RoomBase):
    hotelId: int | None = None


class RoomUpdate(BaseModel):
    number: str | None = Field(None, min_length=1, max_length=20)
    category: str | None = Field(None, min_length=1, max_length=50)
    status: str | None = None
    price: float | None = Field(None, gt=0)
    capacity: int | None = Field(None, ge=1)
    description: str | None = None
    amenities: list[str] | None = None
    hotelId: int | None = None
```

(b) In `create_room`, scope the duplicate check by hotel and persist `hotel_id`:
```python
    existing_room = (
        db.query(RoomModel)
        .filter(RoomModel.number == room.number, RoomModel.hotel_id == room.hotelId)
        .first()
    )
    if existing_room:
        raise HTTPException(status_code=400, detail="Room with this number already exists for this hotel")

    db_room = RoomModel(
        number=room.number,
        category=room.category,
        status=room.status,
        price=room.price,
        capacity=room.capacity,
        description=room.description,
        amenities=room.amenities,
        hotel_id=room.hotelId,
    )
```

(c) In `update_room`, scope the rename check by the room's hotel:
```python
    if room_update.number and room_update.number != db_room.number:
        existing_room = (
            db.query(RoomModel)
            .filter(RoomModel.number == room_update.number, RoomModel.hotel_id == db_room.hotel_id)
            .first()
        )
        if existing_room:
            raise HTTPException(status_code=400, detail="Room with this number already exists for this hotel")
```
Also ensure the `update_data` loop maps `hotelId`→`hotel_id`: after building `update_data = room_update.dict(exclude_unset=True)`, add:
```python
    if "hotelId" in update_data:
        db_room.hotel_id = update_data.pop("hotelId")
```
(place this BEFORE the `for field, value in update_data.items(): setattr(...)` loop).

- [ ] **Step 4: Edit `find_room` in `backend/app/api/v1/hotel_sync.py`** to scope room-number lookups by hotel:
```python
def find_room(db: Session, event: HotelSyncEventRequest) -> RoomModel:
    if event.roomId is not None:
        room = db.query(RoomModel).filter(RoomModel.id == event.roomId).first()
    elif event.roomNumber:
        room = (
            db.query(RoomModel)
            .filter(RoomModel.number == event.roomNumber, RoomModel.hotel_id == event.hotelId)
            .first()
        )
    else:
        raise HTTPException(status_code=422, detail="roomId or roomNumber is required.")

    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")
    return room
```

- [ ] **Step 5: Run new tests + full suite** — expect new tests pass; baseline regression green (existing room tests use `make_room`/endpoints without hotelId → hotel_id None, duplicate check by `(number, None)` still dedupes; verify `test_bookings.py` unaffected). Expect 87+ passed.

- [ ] **Step 6: Commit:**
```
git -C /Users/ataika/Desktop/NextStay-hotel-sync add backend/app/api/v1/rooms.py backend/app/api/v1/hotel_sync.py backend/tests/test_hotel_scoping.py
git -C /Users/ataika/Desktop/NextStay-hotel-sync commit -m "feat(hotel-sync): scope room lookups/duplicate-checks by hotel_id"
```

---

## Task 3: origin/revision columns + anti-echo helper

**Files:** Modify `backend/app/api/v1/hotel_sync.py` (ensure_sync_tables DDL, HotelSyncEventRequest, create_event_record, helper); Create `scripts/migrate_add_sync_origin.sql`; Test add to `backend/tests/test_hotel_sync_security.py` (helper is pure).

- [ ] **Step 1: Write failing test for the anti-echo helper** — append to `backend/tests/test_hotel_sync_security.py`:
```python
from app.api.v1.hotel_sync import should_publish_outbound


def test_should_publish_outbound_only_for_pms_origin():
    assert should_publish_outbound("PMS") is True
    assert should_publish_outbound("HOTEL") is False
    assert should_publish_outbound(None) is False
```

- [ ] **Step 2: Run — confirm FAIL** (`ImportError: cannot import name 'should_publish_outbound'`).

- [ ] **Step 3: Add the helper + origin field to `backend/app/api/v1/hotel_sync.py`:**
(a) Add to `HotelSyncEventRequest` (after `source`): `origin: str = "HOTEL"` and `revision: int = 0`.
(b) Add module-level helper near the top constants:
```python
def should_publish_outbound(origin: str | None) -> bool:
    """Anti-echo: only PMS-originated changes are pushed back to hotels.

    Events that arrived FROM a hotel (origin == 'HOTEL') must never be
    re-published to that hotel, or they would ping-pong forever.
    """
    return origin == "PMS"
```
(c) In `ensure_sync_tables`, add the columns to the `hotel_sync_events` CREATE TABLE (and an idempotent ALTER for existing DBs) — add `origin TEXT NOT NULL DEFAULT 'HOTEL'` and `revision INTEGER NOT NULL DEFAULT 0` to the column list. Also, immediately after the two CREATE TABLE statements, add:
```python
    db.execute(text("ALTER TABLE public.hotel_sync_events ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'HOTEL'"))
    db.execute(text("ALTER TABLE public.hotel_sync_events ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0"))
```
(d) In `create_event_record`, include `origin` in the INSERT column list and params (value `event.origin`).

- [ ] **Step 4: Run helper test — PASS**; run full suite — green (no regression; these DDL paths only run inside hotel_sync endpoints which existing SQLite tests don't hit).

- [ ] **Step 5: Create `scripts/migrate_add_sync_origin.sql`:**
```sql
-- Migration: add origin and revision tracking to hotel sync events.
-- Run once against an existing database.

ALTER TABLE public.hotel_sync_events
ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'HOTEL';

ALTER TABLE public.hotel_sync_events
ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;
```
Lint: `…/.venv/bin/sqlfluff lint …/scripts/migrate_add_sync_origin.sql --dialect postgres` → `All Finished!` (fix layout/casing if needed; no semantic change).

- [ ] **Step 6: Commit:**
```
git -C /Users/ataika/Desktop/NextStay-hotel-sync add backend/app/api/v1/hotel_sync.py scripts/migrate_add_sync_origin.sql backend/tests/test_hotel_sync_security.py
git -C /Users/ataika/Desktop/NextStay-hotel-sync commit -m "feat(hotel-sync): origin/revision tracking + anti-echo helper"
```

---

## Task 4: Outbound publisher (PMS→hotel)

**Files:** Create `backend/app/services/sync_publisher.py`; Test `backend/tests/test_sync_publisher.py`.

Design: a pure `build_outbound_event(...)` that returns the envelope dict, and a `publish_to_hotel(hotel, event_type, data, *, poster=None)` that signs with the hotel's `hmac_secret` and POSTs JSON to `hotel.webhook_url` via an injectable `poster` callable (defaults to a thin httpx wrapper) so tests inject a fake. Skips (returns "skipped") when the hotel has no `webhook_url`.

- [ ] **Step 1: Write failing tests** — `backend/tests/test_sync_publisher.py`:
```python
import json

from app.core.hotel_sync_security import verify_signature
from app.services.sync_publisher import build_outbound_event, publish_to_hotel


class FakeHotel:
    def __init__(self, code="H1", webhook_url="http://hotelsim:8090/webhook", hmac_secret="s3cr3t"):
        self.code = code
        self.webhook_url = webhook_url
        self.hmac_secret = hmac_secret


def test_build_outbound_event_shape():
    ev = build_outbound_event("H1", "booking_cancelled", {"externalBookingId": "x1"}, revision=2)
    assert ev["type"] == "booking_cancelled"
    assert ev["origin"] == "PMS"
    assert ev["hotelCode"] == "H1"
    assert ev["revision"] == 2
    assert ev["data"] == {"externalBookingId": "x1"}
    assert "eventId" in ev


def test_publish_signs_and_posts_to_webhook():
    captured = {}

    def fake_poster(url, *, content, headers):
        captured["url"] = url
        captured["content"] = content
        captured["headers"] = headers
        return 200

    hotel = FakeHotel()
    status = publish_to_hotel(hotel, "booking_cancelled", {"externalBookingId": "x1"}, poster=fake_poster)

    assert status == "sent"
    assert captured["url"] == "http://hotelsim:8090/webhook"
    sig = captured["headers"]["X-NextStay-Signature"]
    assert verify_signature(captured["content"], hotel.hmac_secret, sig) is True
    body = json.loads(captured["content"])
    assert body["type"] == "booking_cancelled"
    assert body["origin"] == "PMS"


def test_publish_skips_when_no_webhook_url():
    hotel = FakeHotel(webhook_url=None)
    called = False

    def fake_poster(url, *, content, headers):
        nonlocal called
        called = True
        return 200

    status = publish_to_hotel(hotel, "booking_cancelled", {"externalBookingId": "x1"}, poster=fake_poster)
    assert status == "skipped"
    assert called is False
```

- [ ] **Step 2: Run — confirm FAIL** (`ModuleNotFoundError`).

- [ ] **Step 3: Implement `backend/app/services/sync_publisher.py`:**
```python
"""Outbound hotel-sync publisher: push PMS-originated changes back to a hotel.

`publish_to_hotel` signs the JSON envelope with the hotel's HMAC secret and
POSTs it to the hotel's webhook URL. The HTTP call is injected via `poster`
so it can be faked in tests; the default uses httpx.

Anti-echo is the caller's responsibility: only call this for PMS-originated
changes (see `should_publish_outbound`). Events ingested FROM a hotel must
not be re-published.
"""

import json
import uuid

import httpx

from app.core.hotel_sync_security import sign_payload
from app.core.logging import get_logger

logger = get_logger(__name__)

_TIMEOUT_SECONDS = 5.0


def build_outbound_event(hotel_code: str, event_type: str, data: dict, *, revision: int = 0) -> dict:
    return {
        "eventId": str(uuid.uuid4()),
        "type": event_type,
        "origin": "PMS",
        "hotelCode": hotel_code,
        "revision": revision,
        "data": data,
    }


def _default_poster(url: str, *, content: bytes, headers: dict) -> int:
    response = httpx.post(url, content=content, headers=headers, timeout=_TIMEOUT_SECONDS)
    return response.status_code


def publish_to_hotel(hotel, event_type: str, data: dict, *, revision: int = 0, poster=None) -> str:
    """Sign and POST an outbound event to the hotel's webhook.

    Returns 'sent', 'skipped' (no webhook configured), or 'failed'.
    """
    if not getattr(hotel, "webhook_url", None):
        return "skipped"

    poster = poster or _default_poster
    event = build_outbound_event(hotel.code, event_type, data, revision=revision)
    content = json.dumps(event).encode("utf-8")
    secret = getattr(hotel, "hmac_secret", None) or ""
    headers = {
        "Content-Type": "application/json",
        "X-NextStay-Signature": sign_payload(content, secret),
    }
    try:
        status_code = poster(hotel.webhook_url, content=content, headers=headers)
    except Exception:
        logger.warning("Outbound hotel-sync publish failed for hotel %s", hotel.code, exc_info=True)
        return "failed"
    if 200 <= status_code < 300:
        return "sent"
    logger.warning("Hotel %s webhook returned status %s", hotel.code, status_code)
    return "failed"
```

- [ ] **Step 4: Run — confirm PASS** (3 tests).
- [ ] **Step 5: Commit:**
```
git -C /Users/ataika/Desktop/NextStay-hotel-sync add backend/app/services/sync_publisher.py backend/tests/test_sync_publisher.py
git -C /Users/ataika/Desktop/NextStay-hotel-sync commit -m "feat(hotel-sync): outbound publisher (sign + POST to hotel webhook)"
```

---

## Task 5: Wire inbound HMAC + outbound hook on PMS-originated booking changes

**Files:** Modify `backend/app/core/config.py`; Modify `backend/app/api/v1/hotel_sync.py` (inbound HMAC); Modify `backend/app/api/v1/bookings.py` (outbound hook); Modify `backend/tests/conftest.py` (SQLite DDL for `hotel_channel_bookings`); Test `backend/tests/test_outbound_sync.py`.

### 5a — config flag
- [ ] **Step 1:** In `backend/app/core/config.py`, after the HOTEL_SYNC_TOKEN lines add:
```python
HOTEL_SYNC_HMAC_ENABLED = os.getenv("HOTEL_SYNC_HMAC_ENABLED", "false").strip().lower() == "true"
```
(Default false so existing token-based dev flow keeps working; enable in prod/demo.)

### 5b — inbound HMAC verification (Postgres/manual-verified; logic isolated)
- [ ] **Step 2:** In `backend/app/api/v1/hotel_sync.py`, import the security util and config flag, and add an extracted, unit-testable verifier used by the endpoint:
```python
from app.core.config import HOTEL_SYNC_HMAC_ENABLED, HOTEL_SYNC_TOKEN, HOTEL_SYNC_TOKEN_ENABLED
from app.core.hotel_sync_security import verify_signature
from app.models.hotel import Hotel as HotelModel  # (added in Phase 1)
```
Add helper:
```python
def authorize_inbound(hotel: "HotelModel | None", raw_body: bytes, signature: str | None, token: str | None) -> None:
    """Authorize an inbound sync event. Prefers per-hotel HMAC when enabled.

    Falls back to the shared dev token when HMAC is disabled. Raises 401 on failure.
    """
    if HOTEL_SYNC_HMAC_ENABLED:
        if not hotel or not hotel.hmac_secret or not verify_signature(raw_body, hotel.hmac_secret, signature):
            raise HTTPException(status_code=401, detail="Invalid or missing HMAC signature.")
        return
    if HOTEL_SYNC_TOKEN_ENABLED and (not HOTEL_SYNC_TOKEN or token != HOTEL_SYNC_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid hotel sync token.")
```
- [ ] **Step 3:** Add unit tests for `authorize_inbound` to `backend/tests/test_hotel_sync_security.py` by monkeypatching the module flags (HMAC on: bad sig → 401, good sig → ok; HMAC off: wrong token → 401). Use `monkeypatch.setattr("app.api.v1.hotel_sync.HOTEL_SYNC_HMAC_ENABLED", True)` etc. Assert `HTTPException` via `pytest.raises`.
- [ ] **Step 4:** Change `receive_hotel_sync_event` to accept the raw `Request`, read `raw_body = await request.body()`, parse the model from it, look up the hotel by `event.hotelId`, and call `authorize_inbound(...)` instead of the old `Depends(require_hotel_sync_token)`. Keep the rest of the flow. (This path uses JSONB — verify on Postgres / manually; covered at the function level by Step 3.) Mark the endpoint `async def`.

### 5c — outbound hook on booking cancel/checkout
- [ ] **Step 5:** In `backend/tests/conftest.py`, add SQLite-compatible DDL for `hotel_channel_bookings` to the `fresh_db` fixture (mirror the columns from `scripts/migrate_add_hotel_sync.sql`, using `INTEGER PRIMARY KEY AUTOINCREMENT` and `TEXT`/`TIMESTAMP` instead of JSONB/SERIAL). Add a teardown `DROP TABLE`.
- [ ] **Step 6: Write failing test** — `backend/tests/test_outbound_sync.py`:
```python
import app.api.v1.bookings as bookings_module
from tests.conftest import login_owner, make_hotel, make_owner, make_room


def test_pms_cancel_of_channel_booking_publishes_outbound(client, db, monkeypatch):
    make_owner(db)
    hotel = make_hotel(db, code="H1", name="H1", webhook_url="http://hotelsim:8090/webhook")
    room = make_room(db, number="101", hotel_id=hotel.id)
    # create a booking and its channel mapping
    from datetime import datetime, timedelta, timezone
    from app.models.booking import Booking
    ci = datetime.now(timezone.utc) + timedelta(days=2)
    co = ci + timedelta(days=1)
    booking = Booking(guest_name="G", room_id=room.id, room_number="101", check_in=ci, check_out=co, status="Upcoming")
    db.add(booking); db.commit(); db.refresh(booking)
    db.execute(
        __import__("sqlalchemy").text(
            "INSERT INTO hotel_channel_bookings (hotel_id, external_booking_id, booking_id, room_id, room_number, source, status) "
            "VALUES (:h, :x, :b, :r, '101', 'hotel_site_simulator', 'active')"
        ),
        {"h": hotel.id, "x": "ext-1", "b": booking.id, "r": room.id},
    )
    db.commit()

    published = {}
    def fake_publish(h, event_type, data, **kw):
        published["hotel_code"] = h.code
        published["type"] = event_type
        published["data"] = data
        return "sent"
    monkeypatch.setattr(bookings_module, "publish_to_hotel", fake_publish)

    token = login_owner(client)
    resp = client.patch(f"/api/v1/bookings/{booking.id}", headers={"Authorization": f"Bearer {token}"}, json={"status": "Cancelled"})
    assert resp.status_code == 200, resp.text
    assert published.get("type") == "booking_cancelled"
    assert published.get("hotel_code") == "H1"
    assert published["data"]["externalBookingId"] == "ext-1"


def test_pms_cancel_of_non_channel_booking_does_not_publish(client, db, monkeypatch):
    make_owner(db)
    room = make_room(db, number="201")
    from datetime import datetime, timedelta, timezone
    from app.models.booking import Booking
    ci = datetime.now(timezone.utc) + timedelta(days=2)
    booking = Booking(guest_name="G", room_id=room.id, room_number="201", check_in=ci, check_out=ci + timedelta(days=1), status="Upcoming")
    db.add(booking); db.commit(); db.refresh(booking)

    calls = []
    monkeypatch.setattr(bookings_module, "publish_to_hotel", lambda *a, **k: calls.append(a) or "sent")
    token = login_owner(client)
    resp = client.patch(f"/api/v1/bookings/{booking.id}", headers={"Authorization": f"Bearer {token}"}, json={"status": "Cancelled"})
    assert resp.status_code == 200, resp.text
    assert calls == []  # no channel mapping → nothing to publish (anti-echo / no-op)
```

- [ ] **Step 7: Run — confirm FAIL** (publish not wired; import error for `publish_to_hotel` in bookings module).

- [ ] **Step 8: Wire the hook in `backend/app/api/v1/bookings.py`** — import and call the publisher when a booking that has a channel mapping transitions to `Cancelled` (and `Checked-out`). Add near the top:
```python
from app.models.hotel import Hotel as HotelModel
from app.services.sync_publisher import publish_to_hotel
```
In `update_booking`, after the existing `status_changing_to == "Checked-out"` block and before `db.commit()`, add:
```python
    if status_changing_to in ("Cancelled", "Checked-out"):
        mapping = db.execute(
            text(
                "SELECT hotel_id, external_booking_id FROM hotel_channel_bookings "
                "WHERE booking_id = :bid AND status = 'active'"
            ),
            {"bid": db_booking.id},
        ).mappings().first()
        if mapping:
            hotel = db.query(HotelModel).filter(HotelModel.id == mapping["hotel_id"]).first()
            if hotel:
                event_type = "booking_cancelled" if status_changing_to == "Cancelled" else "room_status_updated"
                publish_to_hotel(
                    hotel,
                    event_type,
                    {"externalBookingId": mapping["external_booking_id"], "status": status_changing_to},
                )
```
Note: this is PMS-origin by construction (admin PATCH endpoint), satisfying anti-echo without a runtime flag. The publish failure must not break the booking update — `publish_to_hotel` already swallows errors and returns a status string.

- [ ] **Step 9: Run new tests + full suite** — expect green (89+ passed). If `text` is not imported in bookings.py, it already is (used elsewhere). Confirm `test_bookings.py` unaffected.

- [ ] **Step 10: Commit:**
```
git -C /Users/ataika/Desktop/NextStay-hotel-sync add backend/app/core/config.py backend/app/api/v1/hotel_sync.py backend/app/api/v1/bookings.py backend/tests/conftest.py backend/tests/test_outbound_sync.py backend/tests/test_hotel_sync_security.py
git -C /Users/ataika/Desktop/NextStay-hotel-sync commit -m "feat(hotel-sync): inbound HMAC auth + outbound publish on PMS booking changes"
```

---

## Self-Review

- **Spec coverage (§12 deltas 3,4 + carry-over):** HMAC (Task 1,5), hotel validation/scoping (Task 2, Task 5 lookup), origin/revision + anti-echo (Task 3), outbound publisher + hook (Task 4,5), rooms hotel-scoping carry-over (Task 2). Delta 1–2 (registry, hotel_id) done in Phase 1. Mini-site/service = Phase 3.
- **Placeholders:** none — full code provided.
- **Type consistency:** `sign_payload`/`verify_signature`, `should_publish_outbound`, `build_outbound_event`/`publish_to_hotel(hotel,event_type,data,*,revision,poster)` consistent across tasks and call sites; `event_type` values (`booking_cancelled`, `room_status_updated`) match the existing `VALID_EVENT_TYPES` in hotel_sync.py.
- **Testability:** pure functions (Task 1,3,4) and SQLite endpoints (Task 2,5c) are unit-tested; inbound JSONB path (Task 5b) is covered at the `authorize_inbound` function level and flagged for Postgres/manual end-to-end verification.

## Out of scope (Phase 3)
Separate `hotelsim/` service (FastAPI + vanilla mini-site + SQLite store + `POST /webhook` receiver + traffic generator + signed outbound calls to PMS), docker-compose wiring (port 8090), end-to-end demo.
