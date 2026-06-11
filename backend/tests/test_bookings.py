"""Booking endpoint tests: validation, state machine, double-booking guard."""

from datetime import datetime, timedelta, timezone

from .conftest import login_owner, make_owner, make_room


def _future(days=1) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def _booking_payload(room_id: int, room_number: str = "101", days_ahead=1, nights=2):
    check_in = _future(days_ahead)
    check_out = _future(days_ahead + nights)
    return {
        "guestName": "Test Guest",
        "roomId": room_id,
        "roomNumber": room_number,
        "checkIn": check_in,
        "checkOut": check_out,
        "status": "Pending",
    }


# ---------------------------------------------------------------------------
# Booking creation — validation
# ---------------------------------------------------------------------------


class TestBookingValidation:
    def test_create_booking_success(self, client, db):
        make_owner(db)
        room = make_room(db)
        login_owner(client)

        payload = _booking_payload(room.id, room.number)
        r = client.post("/api/v1/bookings", json=payload)
        assert r.status_code == 201
        data = r.json()
        assert data["guestName"] == "Test Guest"
        assert data["roomId"] == room.id
        assert "guestToken" in data

    def test_checkin_in_past_rejected(self, client, db):
        make_owner(db)
        room = make_room(db)

        r = client.post(
            "/api/v1/bookings",
            json={
                "guestName": "Past Guest",
                "roomId": room.id,
                "roomNumber": room.number,
                "checkIn": "2020-01-01T12:00:00+00:00",
                "checkOut": "2020-01-03T12:00:00+00:00",
                "status": "Pending",
            },
        )
        assert r.status_code == 400
        assert "past" in r.json()["detail"].lower()

    def test_checkout_before_checkin_rejected(self, client, db):
        make_owner(db)
        room = make_room(db)

        r = client.post(
            "/api/v1/bookings",
            json={
                "guestName": "Bad Dates",
                "roomId": room.id,
                "roomNumber": room.number,
                "checkIn": _future(3),
                "checkOut": _future(2),
                "status": "Pending",
            },
        )
        assert r.status_code == 400

    def test_invalid_email_rejected(self, client, db):
        make_owner(db)
        room = make_room(db)
        payload = _booking_payload(room.id, room.number)
        payload["email"] = "not-an-email"

        r = client.post("/api/v1/bookings", json=payload)
        assert r.status_code == 422

    def test_valid_email_accepted(self, client, db):
        make_owner(db)
        room = make_room(db)
        payload = _booking_payload(room.id, room.number)
        payload["email"] = "guest@example.com"

        r = client.post("/api/v1/bookings", json=payload)
        assert r.status_code == 201

    def test_room_not_found(self, client, db):
        make_owner(db)
        payload = _booking_payload(9999, "999")

        r = client.post("/api/v1/bookings", json=payload)
        assert r.status_code == 404

    def test_unavailable_room_rejected(self, client, db):
        make_owner(db)
        room = make_room(db, status="Occupied")

        r = client.post("/api/v1/bookings", json=_booking_payload(room.id, room.number))
        assert r.status_code == 400
        assert "not available" in r.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Booking state machine
# ---------------------------------------------------------------------------


class TestBookingStateMachine:
    def _create_booking(self, client, db, status="Pending"):
        make_owner(db)
        room = make_room(db)
        tok = login_owner(client)
        payload = _booking_payload(room.id, room.number)
        payload["status"] = status
        r = client.post("/api/v1/bookings", json=payload)
        assert r.status_code == 201
        return r.json()["id"], tok

    def test_valid_transition_pending_to_confirmed(self, client, db):
        booking_id, tok = self._create_booking(client, db)
        r = client.patch(
            f"/api/v1/bookings/{booking_id}",
            json={"status": "Confirmed"},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "Confirmed"

    def test_valid_transition_pending_to_cancelled(self, client, db):
        booking_id, tok = self._create_booking(client, db)
        r = client.patch(
            f"/api/v1/bookings/{booking_id}",
            json={"status": "Cancelled"},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "Cancelled"

    def test_invalid_transition_pending_to_checked_in(self, client, db):
        booking_id, tok = self._create_booking(client, db)
        r = client.patch(
            f"/api/v1/bookings/{booking_id}",
            json={"status": "Checked-in"},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 400
        assert "transition" in r.json()["detail"].lower() or "Cannot" in r.json()["detail"]

    def test_terminal_state_cancelled_cannot_change(self, client, db):
        booking_id, tok = self._create_booking(client, db)
        # Cancel it
        client.patch(
            f"/api/v1/bookings/{booking_id}",
            json={"status": "Cancelled"},
            headers={"Authorization": f"Bearer {tok}"},
        )
        # Try to re-activate
        r = client.patch(
            f"/api/v1/bookings/{booking_id}",
            json={"status": "Confirmed"},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Room validation
# ---------------------------------------------------------------------------


class TestRoomValidation:
    def _auth_header(self, client, db):
        make_owner(db)
        tok = login_owner(client)
        return {"Authorization": f"Bearer {tok}"}

    def test_create_room_negative_price_rejected(self, client, db):
        headers = self._auth_header(client, db)
        r = client.post(
            "/api/v1/rooms",
            json={
                "number": "201",
                "category": "Standard",
                "status": "Available",
                "price": -50.0,
                "capacity": 2,
            },
            headers=headers,
        )
        assert r.status_code == 422

    def test_create_room_zero_price_rejected(self, client, db):
        headers = self._auth_header(client, db)
        r = client.post(
            "/api/v1/rooms",
            json={
                "number": "202",
                "category": "Standard",
                "status": "Available",
                "price": 0,
                "capacity": 2,
            },
            headers=headers,
        )
        assert r.status_code == 422

    def test_create_room_zero_capacity_rejected(self, client, db):
        headers = self._auth_header(client, db)
        r = client.post(
            "/api/v1/rooms",
            json={
                "number": "203",
                "category": "Standard",
                "status": "Available",
                "price": 100.0,
                "capacity": 0,
            },
            headers=headers,
        )
        assert r.status_code == 422

    def test_create_room_invalid_status_rejected(self, client, db):
        headers = self._auth_header(client, db)
        r = client.post(
            "/api/v1/rooms",
            json={
                "number": "204",
                "category": "Standard",
                "status": "Banana",
                "price": 100.0,
                "capacity": 2,
            },
            headers=headers,
        )
        assert r.status_code == 400

    def test_create_room_success(self, client, db):
        headers = self._auth_header(client, db)
        r = client.post(
            "/api/v1/rooms",
            json={
                "number": "205",
                "category": "Deluxe",
                "status": "Available",
                "price": 150.0,
                "capacity": 3,
            },
            headers=headers,
        )
        assert r.status_code == 201
        assert r.json()["price"] == 150.0


# ---------------------------------------------------------------------------
# Hotel profile validation
# ---------------------------------------------------------------------------


class TestHotelProfileValidation:
    def _auth_header(self, client, db):
        make_owner(db)
        tok = login_owner(client)
        return {"Authorization": f"Bearer {tok}"}

    def test_lat_out_of_range_rejected(self, client, db):
        headers = self._auth_header(client, db)
        r = client.patch("/api/v1/hotel/profile", json={"lat": 999.0}, headers=headers)
        assert r.status_code == 422

    def test_lng_out_of_range_rejected(self, client, db):
        headers = self._auth_header(client, db)
        r = client.patch("/api/v1/hotel/profile", json={"lng": -200.0}, headers=headers)
        assert r.status_code == 422

    def test_valid_coordinates_accepted(self, client, db):
        headers = self._auth_header(client, db)
        r = client.patch("/api/v1/hotel/profile", json={"lat": 45.0, "lng": 9.0}, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["lat"] == 45.0
        assert data["lng"] == 9.0

    def test_invalid_time_format_rejected(self, client, db):
        headers = self._auth_header(client, db)
        r = client.patch("/api/v1/hotel/profile", json={"check_in_time": "2pm"}, headers=headers)
        assert r.status_code == 422

    def test_valid_time_format_accepted(self, client, db):
        headers = self._auth_header(client, db)
        r = client.patch("/api/v1/hotel/profile", json={"check_in_time": "14:00"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["check_in_time"] == "14:00"
