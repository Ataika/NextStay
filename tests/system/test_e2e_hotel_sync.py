"""End-to-end system tests for the bidirectional hotel-site synchronization.

Exercises the running stack exactly as a real channel would: book on the hotel
website simulator -> verify it lands in the PMS; cancel in the PMS -> verify it
propagates back to the hotel site; plus idempotency and auth rejection.
"""

from __future__ import annotations

import uuid

from tests.system.conftest import ADMIN, PMS, SIM, TOKEN


def _book_on_site(client, room="101", ci="2026-09-01T14:00:00Z", co="2026-09-03T12:00:00Z"):
    r = client.post(
        f"{SIM}/api/book",
        json={
            "roomNumber": room,
            "guestName": "System Test",
            "guestEmail": "systest@example.com",
            "checkIn": ci,
            "checkOut": co,
            "amountPaid": 199,
        },
    )
    assert r.status_code == 200, r.text
    return r.json()["externalBookingId"]


def _pms_channel_row(client, external_id):
    r = client.get(f"{PMS}/hotel-sync/channel-bookings", headers=ADMIN)
    assert r.status_code == 200, r.text
    return next((row for row in r.json() if row["externalBookingId"] == external_id), None)


def test_booking_on_hotel_site_appears_in_pms(client):
    ext = _book_on_site(client, room="101", ci="2026-09-01T14:00:00Z", co="2026-09-03T12:00:00Z")
    row = _pms_channel_row(client, ext)
    assert row is not None, "channel mapping not found in PMS"
    assert row["status"] == "active"
    assert row["bookingId"] is not None
    # the internal booking exists and is forward-dated (Upcoming)
    b = client.get(f"{PMS}/bookings/{row['bookingId']}", headers=ADMIN)
    assert b.status_code == 200
    assert b.json()["status"] in ("Upcoming", "Checked-in")


def test_cancel_in_pms_propagates_to_hotel_site(client):
    ext = _book_on_site(client, room="102", ci="2026-10-05T14:00:00Z", co="2026-10-07T12:00:00Z")
    row = _pms_channel_row(client, ext)
    assert row and row["bookingId"]
    # cancel in the PMS (admin) -> outbound signed webhook to the hotel site
    resp = client.patch(f"{PMS}/bookings/{row['bookingId']}", headers=ADMIN, json={"status": "Cancelled"})
    assert resp.status_code == 200, resp.text
    # the hotel site's local booking must now be cancelled
    site = client.get(f"{SIM}/api/bookings")
    assert site.status_code == 200
    local = next((b for b in site.json() if b["external_id"] == ext), None)
    assert local is not None and local["status"] == "cancelled"


def test_duplicate_event_is_idempotent(client):
    event_id = f"systest-{uuid.uuid4().hex[:10]}"
    payload = {
        "eventId": event_id,
        "hotelId": 1,
        "source": "systest",
        "type": "booking_created",
        "origin": "HOTEL",
        "externalBookingId": f"systest-ext-{uuid.uuid4().hex[:8]}",
        "roomNumber": "201",
        "guestName": "Idem Guest",
        "guestEmail": "idem@example.com",
        "checkIn": "2026-11-01T14:00:00Z",
        "checkOut": "2026-11-02T12:00:00Z",
        "amountPaid": 150,
    }
    hdr = {"X-Hotel-Sync-Token": TOKEN}
    first = client.post(f"{PMS}/hotel-sync/events", json=payload, headers=hdr)
    assert first.status_code == 202, first.text
    assert first.json()["action"] == "booking_created"
    second = client.post(f"{PMS}/hotel-sync/events", json=payload, headers=hdr)
    assert second.status_code == 202, second.text
    assert second.json()["action"] == "duplicate_event_ignored"


def test_invalid_sync_token_is_rejected(client):
    payload = {
        "eventId": f"systest-{uuid.uuid4().hex[:10]}",
        "hotelId": 1,
        "source": "systest",
        "type": "booking_created",
        "externalBookingId": f"systest-ext-{uuid.uuid4().hex[:8]}",
        "roomNumber": "201",
        "guestName": "Bad Token",
        "checkIn": "2026-11-10T14:00:00Z",
        "checkOut": "2026-11-11T12:00:00Z",
    }
    resp = client.post(f"{PMS}/hotel-sync/events", json=payload, headers={"X-Hotel-Sync-Token": "WRONG"})
    assert resp.status_code == 401, resp.text
