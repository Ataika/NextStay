# Hotel Sync — Phase 3: Hotel Simulator Service — Implementation Plan

> **Implementation:** follow tasks step by step. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Standalone `hotelsim` service that plays the role of an external hotel's website: a mini booking site + local store, which pushes signed `booking_created`/`booking_cancelled` events to the NextStay PMS and receives PMS→hotel webhooks — closing the bidirectional demo.

**Architecture:** Separate FastAPI app under `hotelsim/` with its own SQLite store, self-contained HMAC signing (same algorithm as the PMS `hotel_sync_security`), a `pms_client` that signs+POSTs to PMS `/api/v1/hotel-sync/events`, a `/webhook` receiver that verifies PMS signatures and updates the local store, a vanilla HTML/JS mini-site, and an optional traffic generator. Wired into docker-compose on port 8090.

**Tech Stack:** FastAPI, SQLite (stdlib `sqlite3`), `httpx`, vanilla HTML/JS, pytest+TestClient. Reuses the backend `.venv` (has fastapi/httpx/pytest).

**Spec:** `docs/superpowers/specs/2026-06-12-hotel-sync-simulator-design.md` (§4.2, §6, §9).
**PMS inbound contract** (from `scripts/simulate_hotel_site_booking.py` + `hotel_sync.py`): POST `/api/v1/hotel-sync/events` with JSON `{eventId, hotelId, source, type, externalBookingId, [roomNumber, guestName, guestEmail, checkIn, checkOut, amountPaid], origin}`, headers `X-Hotel-Sync-Token` and/or `X-NextStay-Signature: sha256=<hmac>`.

**Среда:** sandbox ломает `cd`/`grep`/`find`; абсолютные пути, `git -C <repo>`.
**Тест-команда (PYTHONPATH = repo root, чтобы `import hotelsim.*` резолвился):**
`PYTHONPATH=/Users/ataika/Desktop/NextStay-hotel-sync /Users/ataika/Desktop/NextStay-hotel-sync/backend/.venv/bin/python -m pytest /Users/ataika/Desktop/NextStay-hotel-sync/hotelsim/tests --rootdir=/Users/ataika/Desktop/NextStay-hotel-sync/hotelsim -p no:cacheprovider -q`

---

## File Structure
- `hotelsim/__init__.py`, `hotelsim/tests/__init__.py`
- `hotelsim/config.py` — env: PMS base URL, hotel code/id, hmac secret, sync token, db path.
- `hotelsim/signing.py` — HMAC sign/verify (self-contained copy).
- `hotelsim/store.py` — SQLite store (rooms, bookings, inbound_events) + seed.
- `hotelsim/pms_client.py` — build + sign + POST events to PMS (injectable poster).
- `hotelsim/app.py` — FastAPI app: mini-site + JSON API + `/webhook`.
- `hotelsim/generator.py` — pure "next action" picker + a runner (background).
- `hotelsim/static/index.html` — vanilla mini-site.
- `hotelsim/requirements.txt`, `hotelsim/Dockerfile`.
- Modify `docker-compose.yml` — add `hotelsim` service (port 8090).
- Tests: `hotelsim/tests/{conftest.py,test_signing.py,test_store.py,test_pms_client.py,test_app.py,test_generator.py}`.

---

## Task 1: Scaffolding — config, signing, store

**Files:** create `hotelsim/__init__.py`, `hotelsim/tests/__init__.py`, `hotelsim/config.py`, `hotelsim/signing.py`, `hotelsim/store.py`, `hotelsim/tests/conftest.py`, `hotelsim/tests/test_signing.py`, `hotelsim/tests/test_store.py`.

- [ ] **Step 1: Create package markers** — empty files `hotelsim/__init__.py` and `hotelsim/tests/__init__.py`.

- [ ] **Step 2: Write `hotelsim/tests/test_signing.py` (failing):**
```python
from hotelsim.signing import sign_payload, verify_signature


def test_sign_and_verify_roundtrip():
    body = b'{"x":1}'
    sig = sign_payload(body, "secret")
    assert sig.startswith("sha256=")
    assert verify_signature(body, "secret", sig) is True
    assert verify_signature(b'{"x":2}', "secret", sig) is False
    assert verify_signature(body, "secret", None) is False
```

- [ ] **Step 3: Implement `hotelsim/signing.py`** (identical algorithm to PMS, self-contained so the service has no backend dependency):
```python
"""HMAC-SHA256 signing for hotel-sim ↔ PMS webhooks (self-contained copy)."""

import hashlib
import hmac

_PREFIX = "sha256="


def sign_payload(raw_body: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return f"{_PREFIX}{digest}"


def verify_signature(raw_body: bytes, secret: str, provided: str | None) -> bool:
    if not provided or not provided.startswith(_PREFIX):
        return False
    return hmac.compare_digest(sign_payload(raw_body, secret), provided)
```

- [ ] **Step 4: Implement `hotelsim/config.py`:**
```python
"""hotelsim configuration from environment variables."""

import os


PMS_BASE_URL = os.getenv("PMS_BASE_URL", "http://localhost:8000/api/v1")
HOTEL_CODE = os.getenv("HOTELSIM_CODE", "GRAND_BISHKEK")
HOTEL_ID = int(os.getenv("HOTELSIM_HOTEL_ID", "1"))
HMAC_SECRET = os.getenv("HOTELSIM_HMAC_SECRET", "dev-hotel-hmac-secret")
SYNC_TOKEN = os.getenv("HOTELSIM_SYNC_TOKEN", "dev-hotel-sync-token")
DB_PATH = os.getenv("HOTELSIM_DB_PATH", "hotelsim.db")
```

- [ ] **Step 5: Write `hotelsim/tests/test_store.py` (failing):**
```python
def test_seed_and_list_rooms(store):
    store.seed_rooms([("101", "Standard", 100.0), ("102", "Deluxe", 150.0)])
    rooms = store.list_rooms()
    assert {r["number"] for r in rooms} == {"101", "102"}


def test_create_and_cancel_booking(store):
    store.seed_rooms([("101", "Standard", 100.0)])
    ext_id = store.create_booking("101", "Guest A", "a@x.com", "2026-07-01", "2026-07-03")
    assert ext_id
    bk = store.get_booking(ext_id)
    assert bk["status"] == "active"
    assert bk["room_number"] == "101"
    store.cancel_booking(ext_id)
    assert store.get_booking(ext_id)["status"] == "cancelled"


def test_apply_inbound_cancel_marks_local_booking(store):
    store.seed_rooms([("101", "Standard", 100.0)])
    ext_id = store.create_booking("101", "Guest A", "a@x.com", "2026-07-01", "2026-07-03")
    store.apply_inbound_event({"type": "booking_cancelled", "data": {"externalBookingId": ext_id}})
    assert store.get_booking(ext_id)["status"] == "cancelled"
```

- [ ] **Step 6: Write `hotelsim/tests/conftest.py`:**
```python
import pytest

from hotelsim.store import Store


@pytest.fixture()
def store():
    s = Store(":memory:")
    s.init_schema()
    yield s
    s.close()
```

- [ ] **Step 7: Implement `hotelsim/store.py`:**
```python
"""SQLite-backed local store for the hotel simulator (rooms, bookings, inbound events)."""

import secrets
import sqlite3


class Store:
    def __init__(self, db_path: str):
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row

    def init_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS rooms (
                number TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                price REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'Available'
            );
            CREATE TABLE IF NOT EXISTS bookings (
                external_id TEXT PRIMARY KEY,
                room_number TEXT NOT NULL,
                guest_name TEXT NOT NULL,
                guest_email TEXT,
                check_in TEXT NOT NULL,
                check_out TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS inbound_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                received_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            """
        )
        self._conn.commit()

    def seed_rooms(self, rooms: list[tuple[str, str, float]]) -> None:
        self._conn.executemany(
            "INSERT OR REPLACE INTO rooms (number, category, price) VALUES (?, ?, ?)", rooms
        )
        self._conn.commit()

    def list_rooms(self) -> list[dict]:
        return [dict(r) for r in self._conn.execute("SELECT * FROM rooms ORDER BY number").fetchall()]

    def create_booking(self, room_number, guest_name, guest_email, check_in, check_out) -> str:
        external_id = f"hsim-{secrets.token_urlsafe(8)}"
        self._conn.execute(
            "INSERT INTO bookings (external_id, room_number, guest_name, guest_email, check_in, check_out) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (external_id, room_number, guest_name, guest_email, check_in, check_out),
        )
        self._conn.execute("UPDATE rooms SET status = 'Booked' WHERE number = ?", (room_number,))
        self._conn.commit()
        return external_id

    def get_booking(self, external_id: str) -> dict | None:
        row = self._conn.execute("SELECT * FROM bookings WHERE external_id = ?", (external_id,)).fetchone()
        return dict(row) if row else None

    def list_bookings(self) -> list[dict]:
        return [dict(r) for r in self._conn.execute("SELECT * FROM bookings ORDER BY created_at DESC").fetchall()]

    def cancel_booking(self, external_id: str) -> bool:
        booking = self.get_booking(external_id)
        if not booking:
            return False
        self._conn.execute("UPDATE bookings SET status = 'cancelled' WHERE external_id = ?", (external_id,))
        self._conn.execute("UPDATE rooms SET status = 'Available' WHERE number = ?", (booking["room_number"],))
        self._conn.commit()
        return True

    def apply_inbound_event(self, event: dict) -> None:
        import json as _json

        self._conn.execute(
            "INSERT INTO inbound_events (event_type, payload) VALUES (?, ?)",
            (event.get("type", "unknown"), _json.dumps(event)),
        )
        data = event.get("data", {})
        ext_id = data.get("externalBookingId")
        if event.get("type") == "booking_cancelled" and ext_id:
            self.cancel_booking(ext_id)
        self._conn.commit()

    def list_inbound_events(self) -> list[dict]:
        return [dict(r) for r in self._conn.execute(
            "SELECT * FROM inbound_events ORDER BY received_at DESC"
        ).fetchall()]

    def close(self) -> None:
        self._conn.close()
```

- [ ] **Step 8: Run the test command (signing + store tests) — confirm PASS.**
- [ ] **Step 9: Commit:**
```
git -C /Users/ataika/Desktop/NextStay-hotel-sync add hotelsim/__init__.py hotelsim/tests/__init__.py hotelsim/config.py hotelsim/signing.py hotelsim/store.py hotelsim/tests/conftest.py hotelsim/tests/test_signing.py hotelsim/tests/test_store.py
git -C /Users/ataika/Desktop/NextStay-hotel-sync commit -m "feat(hotelsim): scaffolding — config, signing, SQLite store"
```

---

## Task 2: PMS client (signed outbound)

**Files:** create `hotelsim/pms_client.py`, `hotelsim/tests/test_pms_client.py`.

- [ ] **Step 1: Write `hotelsim/tests/test_pms_client.py` (failing):**
```python
import json

from hotelsim.pms_client import build_event, send_event
from hotelsim.signing import verify_signature


def test_build_event_created_shape():
    ev = build_event(
        "booking_created",
        external_booking_id="hsim-1",
        room_number="101",
        guest_name="A",
        guest_email="a@x.com",
        check_in="2026-07-01T14:00:00Z",
        check_out="2026-07-03T12:00:00Z",
        amount_paid=200.0,
    )
    assert ev["type"] == "booking_created"
    assert ev["origin"] == "HOTEL"
    assert ev["externalBookingId"] == "hsim-1"
    assert ev["roomNumber"] == "101"
    assert "hotelId" in ev and "eventId" in ev and "source" in ev


def test_send_event_signs_and_posts():
    captured = {}

    def fake_poster(url, *, content, headers):
        captured["url"] = url
        captured["content"] = content
        captured["headers"] = headers
        return 202, '{"eventStatus":"processed"}'

    ev = build_event("booking_cancelled", external_booking_id="hsim-1")
    status, _ = send_event(ev, secret="s3cr3t", token="tok", base_url="http://pms:8000/api/v1", poster=fake_poster)

    assert status == 202
    assert captured["url"] == "http://pms:8000/api/v1/hotel-sync/events"
    assert captured["headers"]["X-Hotel-Sync-Token"] == "tok"
    sig = captured["headers"]["X-NextStay-Signature"]
    assert verify_signature(captured["content"], "s3cr3t", sig) is True
    assert json.loads(captured["content"])["origin"] == "HOTEL"
```

- [ ] **Step 2: Run — confirm FAIL.**

- [ ] **Step 3: Implement `hotelsim/pms_client.py`:**
```python
"""Build, sign, and POST hotel-sim events to the NextStay PMS inbound endpoint."""

import json
import time
import uuid

import httpx

from hotelsim import config
from hotelsim.signing import sign_payload

_TIMEOUT = 10.0


def build_event(event_type: str, *, external_booking_id: str, room_number: str | None = None,
                guest_name: str | None = None, guest_email: str | None = None,
                check_in: str | None = None, check_out: str | None = None,
                amount_paid: float | None = None) -> dict:
    event = {
        "eventId": f"hsim-{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}",
        "hotelId": config.HOTEL_ID,
        "source": "hotel_site_simulator",
        "type": event_type,
        "origin": "HOTEL",
        "externalBookingId": external_booking_id,
    }
    if event_type == "booking_created":
        event.update({
            "roomNumber": room_number,
            "guestName": guest_name,
            "guestEmail": guest_email,
            "checkIn": check_in,
            "checkOut": check_out,
            "amountPaid": amount_paid,
        })
    return event


def _default_poster(url: str, *, content: bytes, headers: dict):
    resp = httpx.post(url, content=content, headers=headers, timeout=_TIMEOUT)
    return resp.status_code, resp.text


def send_event(event: dict, *, secret: str | None = None, token: str | None = None,
               base_url: str | None = None, poster=None):
    """Sign and POST an event to PMS. Returns (status_code, response_text)."""
    secret = secret if secret is not None else config.HMAC_SECRET
    token = token if token is not None else config.SYNC_TOKEN
    base_url = base_url if base_url is not None else config.PMS_BASE_URL
    poster = poster or _default_poster

    url = f"{base_url.rstrip('/')}/hotel-sync/events"
    content = json.dumps(event).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "X-Hotel-Sync-Token": token,
        "X-NextStay-Signature": sign_payload(content, secret),
    }
    return poster(url, content=content, headers=headers)
```

- [ ] **Step 4: Run — confirm PASS.**
- [ ] **Step 5: Commit:**
```
git -C /Users/ataika/Desktop/NextStay-hotel-sync add hotelsim/pms_client.py hotelsim/tests/test_pms_client.py
git -C /Users/ataika/Desktop/NextStay-hotel-sync commit -m "feat(hotelsim): signed PMS client (build + sign + POST events)"
```

---

## Task 3: FastAPI app — mini-site API + /webhook receiver

**Files:** create `hotelsim/app.py`, `hotelsim/tests/test_app.py`.

- [ ] **Step 1: Write `hotelsim/tests/test_app.py` (failing):**
```python
import json

from fastapi.testclient import TestClient

from hotelsim.app import create_app
from hotelsim.signing import sign_payload


def _client(monkeypatch, sent):
    app = create_app(db_path=":memory:")
    # capture outbound PMS calls instead of hitting the network
    import hotelsim.app as appmod

    def fake_send(event, **kw):
        sent.append(event)
        return 202, '{"eventStatus":"processed"}'

    monkeypatch.setattr(appmod, "send_event", fake_send)
    return TestClient(app)


def test_book_creates_local_booking_and_pushes_to_pms(monkeypatch):
    sent = []
    client = _client(monkeypatch, sent)
    rooms = client.get("/api/rooms").json()
    assert len(rooms) > 0

    resp = client.post("/api/book", json={
        "roomNumber": rooms[0]["number"], "guestName": "A", "guestEmail": "a@x.com",
        "checkIn": "2026-07-01T14:00:00Z", "checkOut": "2026-07-03T12:00:00Z",
    })
    assert resp.status_code == 200, resp.text
    ext_id = resp.json()["externalBookingId"]
    assert any(e["type"] == "booking_created" and e["externalBookingId"] == ext_id for e in sent)


def test_webhook_rejects_bad_signature(monkeypatch):
    sent = []
    client = _client(monkeypatch, sent)
    body = json.dumps({"type": "booking_cancelled", "data": {"externalBookingId": "x"}}).encode()
    resp = client.post("/webhook", content=body, headers={"X-NextStay-Signature": "sha256=bad"})
    assert resp.status_code == 401


def test_webhook_applies_valid_cancel(monkeypatch):
    from hotelsim import config
    sent = []
    client = _client(monkeypatch, sent)
    rooms = client.get("/api/rooms").json()
    booked = client.post("/api/book", json={
        "roomNumber": rooms[0]["number"], "guestName": "A", "guestEmail": "a@x.com",
        "checkIn": "2026-07-01T14:00:00Z", "checkOut": "2026-07-03T12:00:00Z",
    }).json()
    ext_id = booked["externalBookingId"]

    body = json.dumps({"type": "booking_cancelled", "data": {"externalBookingId": ext_id}}).encode()
    sig = sign_payload(body, config.HMAC_SECRET)
    resp = client.post("/webhook", content=body, headers={"X-NextStay-Signature": sig})
    assert resp.status_code == 200

    bookings = client.get("/api/bookings").json()
    assert any(b["external_id"] == ext_id and b["status"] == "cancelled" for b in bookings)
```

- [ ] **Step 2: Run — confirm FAIL.**

- [ ] **Step 3: Implement `hotelsim/app.py`:**
```python
"""Hotel simulator FastAPI app: mini booking site + JSON API + PMS webhook receiver."""

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from hotelsim import config
from hotelsim.pms_client import build_event, send_event
from hotelsim.signing import verify_signature
from hotelsim.store import Store

_DEFAULT_SEED = [("101", "Standard", 100.0), ("102", "Deluxe", 150.0), ("201", "Suite", 250.0)]
_STATIC_DIR = Path(__file__).parent / "static"


class BookRequest(BaseModel):
    roomNumber: str
    guestName: str
    guestEmail: str | None = None
    checkIn: str
    checkOut: str
    amountPaid: float | None = None


def create_app(db_path: str | None = None) -> FastAPI:
    app = FastAPI(title="NextStay Hotel Simulator")
    store = Store(db_path if db_path is not None else config.DB_PATH)
    store.init_schema()
    store.seed_rooms(_DEFAULT_SEED)
    app.state.store = store

    @app.get("/", response_class=HTMLResponse)
    def index() -> str:
        index_file = _STATIC_DIR / "index.html"
        if index_file.exists():
            return index_file.read_text(encoding="utf-8")
        return "<h1>NextStay Hotel Simulator</h1>"

    @app.get("/api/rooms")
    def api_rooms():
        return store.list_rooms()

    @app.get("/api/bookings")
    def api_bookings():
        return store.list_bookings()

    @app.get("/api/events")
    def api_events():
        return store.list_inbound_events()

    @app.post("/api/book")
    def api_book(req: BookRequest):
        external_id = store.create_booking(
            req.roomNumber, req.guestName, req.guestEmail, req.checkIn, req.checkOut
        )
        event = build_event(
            "booking_created", external_booking_id=external_id, room_number=req.roomNumber,
            guest_name=req.guestName, guest_email=req.guestEmail,
            check_in=req.checkIn, check_out=req.checkOut, amount_paid=req.amountPaid,
        )
        send_event(event)
        return {"externalBookingId": external_id, "status": "active"}

    @app.post("/api/cancel/{external_id}")
    def api_cancel(external_id: str):
        if not store.cancel_booking(external_id):
            raise HTTPException(status_code=404, detail="Booking not found")
        send_event(build_event("booking_cancelled", external_booking_id=external_id))
        return {"externalBookingId": external_id, "status": "cancelled"}

    @app.post("/webhook")
    async def webhook(request: Request):
        raw_body = await request.body()
        signature = request.headers.get("X-NextStay-Signature")
        if not verify_signature(raw_body, config.HMAC_SECRET, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")
        import json as _json

        event = _json.loads(raw_body)
        store.apply_inbound_event(event)
        return {"status": "ok"}

    return app


app = create_app()
```
NOTE: `send_event` is imported at module scope so tests can `monkeypatch.setattr(hotelsim.app, "send_event", ...)`. `api_book` calls the module-level name.

- [ ] **Step 4: Run — confirm all app tests PASS.**
- [ ] **Step 5: Commit:**
```
git -C /Users/ataika/Desktop/NextStay-hotel-sync add hotelsim/app.py hotelsim/tests/test_app.py
git -C /Users/ataika/Desktop/NextStay-hotel-sync commit -m "feat(hotelsim): FastAPI app — booking API + signed PMS push + webhook receiver"
```

---

## Task 4: Vanilla mini-site

**Files:** create `hotelsim/static/index.html`; add a smoke test to `hotelsim/tests/test_app.py`.

- [ ] **Step 1: Add a failing smoke test** to `hotelsim/tests/test_app.py`:
```python
def test_index_serves_html(monkeypatch):
    sent = []
    client = _client(monkeypatch, sent)
    resp = client.get("/")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "Hotel" in resp.text
```

- [ ] **Step 2: Run — confirm it PASSES already** (the fallback `<h1>` contains "Hotel"). Then create the real mini-site so the route serves it.

- [ ] **Step 3: Create `hotelsim/static/index.html`** — a single self-contained page (vanilla HTML/JS, no build) that: lists rooms (`GET /api/rooms`), has a form to book a room (`POST /api/book`), lists local bookings with a Cancel button (`POST /api/cancel/{id}`), and shows inbound PMS events (`GET /api/events`). Keep it dependency-free (fetch + minimal CSS). Title must contain "Hotel". Example skeleton (fill in fetch handlers):
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NextStay — Hotel Site Simulator</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 880px; margin: 2rem auto; padding: 0 1rem; }
    .room, .booking { border: 1px solid #ddd; border-radius: 8px; padding: .75rem 1rem; margin: .5rem 0; }
    button { cursor: pointer; }
    .muted { color: #777; font-size: .85rem; }
  </style>
</head>
<body>
  <h1>🏨 Hotel Site Simulator</h1>
  <p class="muted">External hotel website — books sync into NextStay PMS; PMS changes appear here.</p>
  <h2>Rooms</h2><div id="rooms"></div>
  <h2>Bookings</h2><div id="bookings"></div>
  <h2>Inbound PMS events</h2><div id="events"></div>
  <script>
    async function j(u, o){ const r = await fetch(u, o); return r.json(); }
    async function refresh(){
      const rooms = await j('/api/rooms');
      document.getElementById('rooms').innerHTML = rooms.map(r =>
        `<div class="room"><b>${r.number}</b> — ${r.category} ($${r.price}) — ${r.status}
         <button onclick="book('${r.number}')" ${r.status!=='Available'?'disabled':''}>Book</button></div>`).join('');
      const bookings = await j('/api/bookings');
      document.getElementById('bookings').innerHTML = bookings.map(b =>
        `<div class="booking">${b.room_number} — ${b.guest_name} — <b>${b.status}</b>
         ${b.status==='active'?`<button onclick="cancel('${b.external_id}')">Cancel</button>`:''}</div>`).join('');
      const events = await j('/api/events');
      document.getElementById('events').innerHTML = events.map(e =>
        `<div class="muted">${e.received_at} — ${e.event_type}</div>`).join('');
    }
    async function book(num){
      await j('/api/book', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({roomNumber:num, guestName:'Walk-in Guest', guestEmail:'guest@example.com',
          checkIn:'2026-07-01T14:00:00Z', checkOut:'2026-07-03T12:00:00Z', amountPaid:180})});
      refresh();
    }
    async function cancel(id){ await fetch('/api/cancel/'+id, {method:'POST'}); refresh(); }
    refresh(); setInterval(refresh, 4000);
  </script>
</body>
</html>
```

- [ ] **Step 4: Run the app tests — confirm green (the smoke test now serves the real file).**
- [ ] **Step 5: Commit:**
```
git -C /Users/ataika/Desktop/NextStay-hotel-sync add hotelsim/static/index.html hotelsim/tests/test_app.py
git -C /Users/ataika/Desktop/NextStay-hotel-sync commit -m "feat(hotelsim): vanilla mini-site (rooms, booking, cancel, inbound events)"
```

---

## Task 5: Traffic generator + Docker wiring

**Files:** create `hotelsim/generator.py`, `hotelsim/tests/test_generator.py`, `hotelsim/requirements.txt`, `hotelsim/Dockerfile`; modify `docker-compose.yml`.

- [ ] **Step 1: Write `hotelsim/tests/test_generator.py` (failing):**
```python
from hotelsim.generator import choose_action
from hotelsim.store import Store


def _store():
    s = Store(":memory:")
    s.init_schema()
    s.seed_rooms([("101", "Standard", 100.0)])
    return s


def test_choose_action_books_when_rooms_available():
    s = _store()
    action = choose_action(s, rng_value=0.0)  # low value → book
    assert action["kind"] == "book"
    assert action["roomNumber"] == "101"


def test_choose_action_cancels_when_active_booking_and_high_rng():
    s = _store()
    s.create_booking("101", "G", "g@x.com", "2026-07-01", "2026-07-03")
    action = choose_action(s, rng_value=0.99)  # high value → cancel an active booking
    assert action["kind"] == "cancel"


def test_choose_action_noop_when_nothing_to_do():
    s = Store(":memory:")
    s.init_schema()  # no rooms
    action = choose_action(s, rng_value=0.0)
    assert action["kind"] == "noop"
```

- [ ] **Step 2: Run — confirm FAIL.**

- [ ] **Step 3: Implement `hotelsim/generator.py`** (pure `choose_action` for testability + an async runner using it):
```python
"""Traffic generator for the hotel simulator: periodically books/cancels rooms."""

import asyncio

from hotelsim import config
from hotelsim.pms_client import build_event, send_event


def choose_action(store, rng_value: float) -> dict:
    """Pure decision function. rng_value in [0,1). Returns an action dict.

    Low rng → book an available room; high rng → cancel an active booking.
    Falls back to the other action or 'noop' when one isn't possible.
    """
    available = [r for r in store.list_rooms() if r["status"] == "Available"]
    active = [b for b in store.list_bookings() if b["status"] == "active"]
    want_cancel = rng_value >= 0.5
    if want_cancel and active:
        return {"kind": "cancel", "externalBookingId": active[0]["external_id"]}
    if available:
        return {"kind": "book", "roomNumber": available[0]["number"]}
    if active:
        return {"kind": "cancel", "externalBookingId": active[0]["external_id"]}
    return {"kind": "noop"}


def apply_action(store, action: dict) -> None:
    if action["kind"] == "book":
        ext_id = store.create_booking(
            action["roomNumber"], "Auto Guest", "auto@example.com",
            "2026-07-01T14:00:00Z", "2026-07-03T12:00:00Z",
        )
        send_event(build_event(
            "booking_created", external_booking_id=ext_id, room_number=action["roomNumber"],
            guest_name="Auto Guest", guest_email="auto@example.com",
            check_in="2026-07-01T14:00:00Z", check_out="2026-07-03T12:00:00Z", amount_paid=160.0,
        ))
    elif action["kind"] == "cancel":
        store.cancel_booking(action["externalBookingId"])
        send_event(build_event("booking_cancelled", external_booking_id=action["externalBookingId"]))


async def run(store, *, interval_seconds: float = 20.0) -> None:  # pragma: no cover
    import random

    while True:
        apply_action(store, choose_action(store, random.random()))
        await asyncio.sleep(interval_seconds)


_ = config  # reserved for future per-hotel config
```

- [ ] **Step 4: Run generator tests — confirm PASS.**

- [ ] **Step 5: Create `hotelsim/requirements.txt`:**
```
fastapi>=0.100.0
uvicorn[standard]>=0.23.0
httpx>=0.24.0
```

- [ ] **Step 6: Create `hotelsim/Dockerfile`:**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY hotelsim/requirements.txt /app/hotelsim/requirements.txt
RUN pip install --no-cache-dir -r /app/hotelsim/requirements.txt
COPY hotelsim /app/hotelsim
ENV HOTELSIM_DB_PATH=/app/hotelsim.db
EXPOSE 8090
CMD ["uvicorn", "hotelsim.app:app", "--host", "0.0.0.0", "--port", "8090"]
```

- [ ] **Step 7: Add a `hotelsim` service to `docker-compose.yml`** (read the file first; mirror the style/network of existing services). Add under `services:`:
```yaml
  hotelsim:
    build:
      context: .
      dockerfile: hotelsim/Dockerfile
    ports:
      - "8090:8090"
    environment:
      PMS_BASE_URL: "http://backend:8000/api/v1"
      HOTELSIM_CODE: "GRAND_BISHKEK"
      HOTELSIM_HOTEL_ID: "1"
      HOTELSIM_HMAC_SECRET: "dev-hotel-hmac-secret"
      HOTELSIM_SYNC_TOKEN: "dev-hotel-sync-token"
    depends_on:
      - backend
```
(Use the actual backend service name from the compose file; adjust `PMS_BASE_URL`/`depends_on` to match. Validate YAML — the `check-yaml` pre-commit hook must pass.)

- [ ] **Step 8: Run the full hotelsim test suite — confirm all green.**
- [ ] **Step 9: Commit:**
```
git -C /Users/ataika/Desktop/NextStay-hotel-sync add hotelsim/generator.py hotelsim/tests/test_generator.py hotelsim/requirements.txt hotelsim/Dockerfile docker-compose.yml
git -C /Users/ataika/Desktop/NextStay-hotel-sync commit -m "feat(hotelsim): traffic generator + Dockerfile + docker-compose wiring"
```

---

## Self-Review
- **Spec coverage (§4.2, §6, §9):** mini-site (Task 4), SQLite store (Task 1), `/webhook` receiver with signature verify (Task 3), traffic generator (Task 5), signed outbound to PMS (Task 2), docker-compose port 8090 (Task 5). Anti-echo: hotelsim applies inbound PMS cancels to its store but does NOT re-emit them (apply_inbound_event never calls send_event) — mirrors the PMS-side call-site separation.
- **Placeholders:** none — full code provided; index.html skeleton is complete and functional.
- **Type/name consistency:** `build_event`/`send_event` signatures consistent across pms_client, app, generator; `sign_payload`/`verify_signature` consistent; event `type` values (`booking_created`/`booking_cancelled`) match PMS `VALID_EVENT_TYPES`; outbound `origin="HOTEL"` so PMS stores it correctly and won't echo.
- **Testability:** signing/store/pms_client/generator are unit-tested; the app + webhook via TestClient with a monkeypatched `send_event` (no network). Generator's pure `choose_action` is tested; `run()` loop excluded from coverage.

## Carry-over from Phase 2 review (address here or note)
- Reject empty `hmac_secret` at PMS hotel registration (PMS-side; optional follow-up).
- Verify the full PMS inbound flow against PostgreSQL once docker-compose is up (manual e2e: book on mini-site → appears in PMS admin; cancel in PMS → mini-site updates).
