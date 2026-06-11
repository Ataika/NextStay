from datetime import datetime, timedelta, timezone

import app.api.v1.bookings as bookings_module
import sqlalchemy
from app.models.booking import Booking

from tests.conftest import login_owner, make_hotel, make_owner, make_room


def _make_booking(db, room, status="Upcoming"):
    ci = datetime.now(timezone.utc) + timedelta(days=2)
    co = ci + timedelta(days=1)
    booking = Booking(
        guest_name="G", room_id=room.id, room_number=room.number, check_in=ci, check_out=co, status=status
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def test_pms_cancel_of_channel_booking_publishes_outbound(client, db, monkeypatch):
    make_owner(db)
    hotel = make_hotel(db, code="H1", name="H1", webhook_url="http://hotelsim:8090/webhook")
    room = make_room(db, number="101", hotel_id=hotel.id)
    booking = _make_booking(db, room)
    db.execute(
        sqlalchemy.text(
            "INSERT INTO hotel_channel_bookings "
            "(hotel_id, external_booking_id, booking_id, room_id, room_number, source, status) "
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
    resp = client.patch(
        f"/api/v1/bookings/{booking.id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"status": "Cancelled"},
    )
    assert resp.status_code == 200, resp.text
    assert published.get("type") == "booking_cancelled"
    assert published.get("hotel_code") == "H1"
    assert published["data"]["externalBookingId"] == "ext-1"


def test_pms_cancel_of_non_channel_booking_does_not_publish(client, db, monkeypatch):
    make_owner(db)
    room = make_room(db, number="201")
    booking = _make_booking(db, room)

    calls = []
    monkeypatch.setattr(bookings_module, "publish_to_hotel", lambda *a, **k: calls.append(a) or "sent")

    token = login_owner(client)
    resp = client.patch(
        f"/api/v1/bookings/{booking.id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"status": "Cancelled"},
    )
    assert resp.status_code == 200, resp.text
    assert calls == []
