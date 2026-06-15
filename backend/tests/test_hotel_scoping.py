from tests.conftest import login_owner, make_hotel, make_owner, make_room


def test_create_room_same_number_different_hotel_allowed(db):
    # uq(hotel_id, number) permits the same room number across different hotels.
    # (Room creation is hotel-scoped to the authenticated owner via tenancy, so the
    # cross-hotel invariant is exercised directly at the DB level here.)
    h1 = make_hotel(db, code="H1", name="H1")
    h2 = make_hotel(db, code="H2", name="H2")

    r1 = make_room(db, number="101", hotel_id=h1.id)
    r2 = make_room(db, number="101", hotel_id=h2.id)

    assert r1.number == r2.number == "101"
    assert r1.hotel_id != r2.hotel_id


def test_create_room_duplicate_number_same_hotel_rejected(client, db):
    make_owner(db)
    h1 = make_hotel(db, code="H1", name="H1")
    token = login_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    body = {
        "number": "101",
        "category": "Standard",
        "status": "Available",
        "price": 100,
        "capacity": 2,
        "hotelId": h1.id,
    }

    assert client.post("/api/v1/rooms", headers=headers, json=body).status_code == 201
    assert client.post("/api/v1/rooms", headers=headers, json=body).status_code == 400
