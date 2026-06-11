from tests.conftest import login_owner, make_hotel, make_owner


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
