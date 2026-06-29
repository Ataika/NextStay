"""
Shared test fixtures.

Uses an in-memory SQLite database so tests run without a PostgreSQL instance.
SQLite doesn't support SELECT FOR UPDATE; we patch Query.with_for_update to a
no-op so the booking endpoint tests can still exercise validation logic.
"""

import os
from unittest.mock import patch

import pytest

# Point all config at safe test defaults before any app code is imported.
os.environ.setdefault("AUTH_JWT_SECRET", "test-secret-do-not-use-in-prod")
os.environ.setdefault("OTP_SECRET", "test-otp-secret")
os.environ.setdefault("NEXTSTAY_ENV", "test")
os.environ.setdefault("DEV_OWNER_TOKEN_ENABLED", "false")

from app.db.base import Base
from app.main import app
from app.models import auth_session as _as_mod  # noqa: F401
from app.models import booking as _booking_mod  # noqa: F401
from app.models import chat_conversation as _cc_mod  # noqa: F401
from app.models import chat_message as _cm_mod  # noqa: F401
from app.models import chat_participant as _cp_mod  # noqa: F401
from app.models import company as _company_mod  # noqa: F401
from app.models import email_otp as _otp_mod  # noqa: F401
from app.models import guest_token as _gt_mod  # noqa: F401
from app.models import hotel as _hotel_mod  # noqa: F401
from app.models import hotel_invite as _hi_mod  # noqa: F401
from app.models import hotel_profile as _hp_mod  # noqa: F401
from app.models import payment as _payment_mod  # noqa: F401
from app.models import room as _room_mod  # noqa: F401
from app.models import task as _task_mod  # noqa: F401
from app.models import user as _user_mod  # noqa: F401  ensure model registered
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

SQLITE_URL = "sqlite://"  # in-memory, shared via StaticPool

engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Override every router's get_db with our SQLite one.
from app.api.v1 import (  # noqa: E402
    auth,
    bookings,
    chat,
    companies,
    hotel_profile,
    hotel_sync,
    register,
    reports,
    rooms,
    staff,
    stripe,
    tasks,
    users,
)
from app.security import auth as security_auth  # noqa: E402

for module in (
    auth,
    bookings,
    rooms,
    tasks,
    hotel_profile,
    staff,
    chat,
    hotel_sync,
    register,
    users,
    stripe,
    companies,
    reports,
):
    app.dependency_overrides[module.get_db] = override_get_db

app.dependency_overrides[security_auth.get_db] = override_get_db


_ROOM_HOLDS_DDL = """
CREATE TABLE IF NOT EXISTS room_holds (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id    INTEGER NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    check_in   DATETIME NOT NULL,
    check_out  DATETIME NOT NULL,
    session_id TEXT NOT NULL,
    expires_at DATETIME NOT NULL
)
"""

_HOTEL_CHANNEL_BOOKINGS_DDL = """
CREATE TABLE IF NOT EXISTS hotel_channel_bookings (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id            INTEGER NOT NULL DEFAULT 1,
    external_booking_id TEXT    NOT NULL,
    booking_id          INTEGER,
    room_id             INTEGER,
    room_number         TEXT    NOT NULL,
    source              TEXT    NOT NULL DEFAULT 'hotel_site_simulator',
    status              TEXT    NOT NULL DEFAULT 'active',
    check_in            TIMESTAMP,
    check_out           TIMESTAMP,
    guest_name          TEXT,
    guest_email         TEXT,
    synced_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancelled_at        TIMESTAMP
)
"""

_STAFF_DDL = [
    """
    CREATE TABLE IF NOT EXISTS staff_members (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT    NOT NULL,
        role            TEXT    NOT NULL,
        email           TEXT,
        phone           TEXT,
        hire_date       DATE,
        is_active       INTEGER NOT NULL DEFAULT 1,
        annual_days_off INTEGER NOT NULL DEFAULT 20,
        hotel_id        INTEGER
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS staff_shifts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        staff_id    INTEGER NOT NULL REFERENCES staff_members (id),
        shift_date  DATE    NOT NULL,
        shift_type  TEXT    NOT NULL,
        hours       REAL    NOT NULL DEFAULT 0.0,
        notes       TEXT,
        UNIQUE (staff_id, shift_date)
    )
    """,
]


@pytest.fixture(autouse=True)
def fresh_db():
    """Recreate all tables before each test, then drop them after."""
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(text(_ROOM_HOLDS_DDL))
        for stmt in _STAFF_DDL:
            conn.execute(text(stmt))
        conn.execute(text(_HOTEL_CHANNEL_BOOKINGS_DDL))
        conn.commit()
    yield
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS staff_shifts"))
        conn.execute(text("DROP TABLE IF EXISTS staff_members"))
        conn.execute(text("DROP TABLE IF EXISTS room_holds"))
        conn.execute(text("DROP TABLE IF EXISTS hotel_channel_bookings"))
        conn.commit()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    """Direct DB session for setup / assertions."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client():
    with (
        patch("sqlalchemy.orm.Query.with_for_update", lambda self, **_kw: self),
        patch("app.main.prepare_database", lambda: None),
    ):
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def make_owner(db, email="owner@test.com", hotel_name="Test Hotel"):
    from app.api.v1.auth import hash_password
    from app.models.hotel_profile import HotelProfile
    from app.models.user import User

    hotel = HotelProfile(hotel_name=hotel_name)
    db.add(hotel)
    db.flush()

    user = User(
        email=email,
        full_name="Test Owner",
        role="OWNER",
        is_active=True,
        password_hash=hash_password("Password1!"),
        hotel_id=hotel.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_hotel(db, code="DEFAULT", name="Default Hotel", webhook_url=None, hmac_secret="test-secret"):
    """Create the canonical `hotels` row plus its 1:1 `hotel_profile` extension (shared PK)."""
    from app.models.hotel import Hotel
    from app.models.hotel_profile import HotelProfile

    hotel = Hotel(code=code, name=name, webhook_url=webhook_url, hmac_secret=hmac_secret, active=True)
    db.add(hotel)
    db.flush()
    if not db.query(HotelProfile).filter(HotelProfile.id == hotel.id).first():
        db.add(HotelProfile(id=hotel.id, hotel_name=name))
    db.commit()
    db.refresh(hotel)
    return hotel


def make_room(db, number="101", price=100.0, status="Available", hotel_id=None):
    from app.models.hotel import Hotel
    from app.models.room import Room

    if hotel_id is None:
        hotel = db.query(Hotel).first()
        if not hotel:
            hotel = make_hotel(db, name="Test Hotel")
        hotel_id = hotel.id

    room = Room(
        hotel_id=hotel_id,
        number=number,
        category="Standard",
        status=status,
        price=price,
        capacity=2,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def login_owner(client) -> str:
    """Login as the owner and return a bearer token."""
    resp = client.post(
        "/api/v1/auth/login",
        json={
            "email": "owner@test.com",
            "password": "Password1!",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]
