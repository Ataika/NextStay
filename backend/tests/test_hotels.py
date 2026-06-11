import pytest
from sqlalchemy.exc import IntegrityError


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
