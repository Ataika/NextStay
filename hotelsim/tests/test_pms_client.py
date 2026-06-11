import json

from hotelsim.pms_client import build_event, send_event
from hotelsim.signing import verify_signature


def test_build_event_created_shape():
    ev = build_event(
        "booking_created",
        external_booking_id="hsim-1",
        room_number="101",
        guest_name="A",
        guest_email="a@x.com",
        check_in="2026-07-01T14:00:00Z",
        check_out="2026-07-03T12:00:00Z",
        amount_paid=200.0,
    )
    assert ev["type"] == "booking_created"
    assert ev["origin"] == "HOTEL"
    assert ev["externalBookingId"] == "hsim-1"
    assert ev["roomNumber"] == "101"
    assert "hotelId" in ev and "eventId" in ev and "source" in ev


def test_send_event_signs_and_posts():
    captured = {}

    def fake_poster(url, *, content, headers):
        captured["url"] = url
        captured["content"] = content
        captured["headers"] = headers
        return 202, '{"eventStatus":"processed"}'

    ev = build_event("booking_cancelled", external_booking_id="hsim-1")
    status, _ = send_event(ev, secret="s3cr3t", token="tok", base_url="http://pms:8000/api/v1", poster=fake_poster)

    assert status == 202
    assert captured["url"] == "http://pms:8000/api/v1/hotel-sync/events"
    assert captured["headers"]["X-Hotel-Sync-Token"] == "tok"
    sig = captured["headers"]["X-NextStay-Signature"]
    assert verify_signature(captured["content"], "s3cr3t", sig) is True
    assert json.loads(captured["content"])["origin"] == "HOTEL"
