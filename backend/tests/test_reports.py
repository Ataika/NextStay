"""Tests for the hotel-scoped reports overview endpoint."""

from datetime import datetime, timedelta, timezone

from app.models.booking import Booking
from app.models.room import Room

from .conftest import login_owner, make_hotel, make_owner


def _room(db, hotel_id, number, category="Standard", price=100.0):
    room = Room(number=number, category=category, status="Available", price=price, capacity=2, hotel_id=hotel_id)
    db.add(room)
    db.flush()
    return room


def _booking(db, room, status, amount=None):
    now = datetime.now(timezone.utc)
    b = Booking(
        guest_name="Guest",
        guest_email="g@test.com",
        room_id=room.id,
        room_number=room.number,
        check_in=now,
        check_out=now + timedelta(days=1),
        status=status,
        amount_paid=amount,
    )
    db.add(b)
    db.flush()
    return b


def _auth(client, db):
    make_owner(db)
    return {"Authorization": f"Bearer {login_owner(client)}"}


def test_overview_kpis(client, db):
    headers = _auth(client, db)
    hotel = make_hotel(db, code="H1", name="Hotel One")
    std = _room(db, hotel.id, "101", category="Standard", price=100.0)
    deluxe = _room(db, hotel.id, "201", category="Deluxe", price=300.0)
    _booking(db, std, "Confirmed", amount=200.0)
    _booking(db, deluxe, "Confirmed", amount=600.0)
    _booking(db, std, "Cancelled", amount=None)
    db.commit()

    r = client.get(f"/api/v1/reports/overview?hotel_id={hotel.id}&days=30", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    k = body["kpis"]
    assert k["totalBookings"] == 3
    assert k["confirmedBookings"] == 2
    assert k["cancelledBookings"] == 1
    assert k["totalRevenue"] == 800.0
    assert k["avgBookingValue"] == 400.0
    assert k["roomsTotal"] == 2
    assert k["occupancyRate"] == 1.0  # both rooms had a confirmed booking
    # Revenue by category, sorted desc
    cats = {c["category"]: c["revenue"] for c in body["revenueByCategory"]}
    assert cats == {"Deluxe": 600.0, "Standard": 200.0}
    assert body["revenueByCategory"][0]["category"] == "Deluxe"


def test_overview_is_hotel_scoped(client, db):
    headers = _auth(client, db)
    h1 = make_hotel(db, code="H1", name="Hotel One")
    h2 = make_hotel(db, code="H2", name="Hotel Two")
    _booking(db, _room(db, h1.id, "101"), "Confirmed", amount=100.0)
    _booking(db, _room(db, h2.id, "101"), "Confirmed", amount=999.0)
    db.commit()

    r = client.get(f"/api/v1/reports/overview?hotel_id={h1.id}&days=30", headers=headers)
    assert r.status_code == 200
    assert r.json()["kpis"]["totalRevenue"] == 100.0  # h2 excluded


def test_overview_requires_auth(client, db):
    make_hotel(db, code="H1", name="Hotel One")
    r = client.get("/api/v1/reports/overview?hotel_id=1&days=30")
    assert r.status_code in (401, 403)
