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

    resp = client.post(
        "/api/book",
        json={
            "roomNumber": rooms[0]["number"],
            "guestName": "A",
            "guestEmail": "a@x.com",
            "checkIn": "2026-07-01T14:00:00Z",
            "checkOut": "2026-07-03T12:00:00Z",
        },
    )
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
    booked = client.post(
        "/api/book",
        json={
            "roomNumber": rooms[0]["number"],
            "guestName": "A",
            "guestEmail": "a@x.com",
            "checkIn": "2026-07-01T14:00:00Z",
            "checkOut": "2026-07-03T12:00:00Z",
        },
    ).json()
    ext_id = booked["externalBookingId"]

    body = json.dumps({"type": "booking_cancelled", "data": {"externalBookingId": ext_id}}).encode()
    sig = sign_payload(body, config.HMAC_SECRET)
    resp = client.post("/webhook", content=body, headers={"X-NextStay-Signature": sig})
    assert resp.status_code == 200

    bookings = client.get("/api/bookings").json()
    assert any(b["external_id"] == ext_id and b["status"] == "cancelled" for b in bookings)
