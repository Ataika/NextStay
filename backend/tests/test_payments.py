"""Tests for the Stripe payments audit + idempotent webhook."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from app.models.booking import Booking
from app.models.payment import Payment
from app.models.room import Room

from .conftest import make_hotel

WEBHOOK_URL = "/api/v1/stripe/webhook"


def _setup_booking(db, *, status="Pending"):
    hotel = make_hotel(db, code="H1", name="Hotel One")
    room = Room(number="101", category="Standard", status="Available", price=100.0, capacity=2, hotel_id=hotel.id)
    db.add(room)
    db.flush()
    now = datetime.now(timezone.utc)
    booking = Booking(
        guest_name="Guest",
        guest_email="guest@test.com",
        room_id=room.id,
        room_number="101",
        check_in=now,
        check_out=now + timedelta(days=1),
        status=status,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return hotel, room, booking


def _event(event_id, booking_id, *, event_type="checkout.session.completed", amount_total=20000):
    return {
        "id": event_id,
        "type": event_type,
        "data": {
            "object": {
                "id": "cs_test_123",
                "payment_intent": "pi_test_123",
                "payment_status": "paid",
                "currency": "usd",
                "amount_total": amount_total,
                "customer_details": {"email": "guest@test.com"},
                "metadata": {"booking_id": str(booking_id)} if booking_id is not None else {},
            }
        },
    }


@pytest.fixture()
def stripe_env():
    """Configure a webhook secret and bypass signature + email sending."""
    with (
        patch("app.api.v1.stripe.STRIPE_WEBHOOK_SECRET", "whsec_test"),
        patch("app.api.v1.stripe.send_booking_confirmation_to_guest", lambda **_kw: None),
        patch("app.api.v1.stripe.send_booking_notification_to_owner", lambda **_kw: None),
    ):
        yield


def _post(client, event):
    with patch("stripe.Webhook.construct_event", lambda *a, **k: event):
        return client.post(WEBHOOK_URL, content=b"{}", headers={"stripe-signature": "t=1,v1=x"})


def test_webhook_creates_payment_and_confirms_booking(client, db, stripe_env):
    _hotel, _room, booking = _setup_booking(db)
    resp = _post(client, _event("evt_1", booking.id))
    assert resp.status_code == 200

    payments = db.query(Payment).all()
    assert len(payments) == 1
    assert payments[0].stripe_event_id == "evt_1"
    assert payments[0].event_type == "checkout.session.completed"
    db.refresh(booking)
    assert booking.status == "Confirmed"


def test_duplicate_event_is_idempotent(client, db, stripe_env):
    _hotel, _room, booking = _setup_booking(db)
    _post(client, _event("evt_dup", booking.id))
    # Redeliver the same event id.
    resp = _post(client, _event("evt_dup", booking.id))
    assert resp.status_code == 200

    assert db.query(Payment).count() == 1  # no duplicate audit row
    db.refresh(booking)
    assert booking.status == "Confirmed"


def test_hotel_id_derived_from_booking(client, db, stripe_env):
    _hotel, room, booking = _setup_booking(db)
    _post(client, _event("evt_hotel", booking.id))
    payment = db.query(Payment).filter(Payment.stripe_event_id == "evt_hotel").one()
    assert payment.hotel_id == room.hotel_id
    assert payment.booking_id == booking.id


def test_unknown_event_type_is_audited_but_booking_untouched(client, db, stripe_env):
    _hotel, _room, booking = _setup_booking(db)
    resp = _post(client, _event("evt_pi", booking.id, event_type="payment_intent.succeeded"))
    assert resp.status_code == 200
    payment = db.query(Payment).filter(Payment.stripe_event_id == "evt_pi").one()
    assert payment.event_type == "payment_intent.succeeded"
    db.refresh(booking)
    assert booking.status == "Pending"  # business logic not run


def test_missing_booking_is_audited_with_no_fk(client, db, stripe_env):
    resp = _post(client, _event("evt_nobooking", 99999))
    assert resp.status_code == 200
    payment = db.query(Payment).filter(Payment.stripe_event_id == "evt_nobooking").one()
    assert payment.booking_id is None  # dangling id not stored as FK
    assert payment.hotel_id is None
