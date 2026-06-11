import json

from app.core.hotel_sync_security import verify_signature
from app.services.sync_publisher import build_outbound_event, publish_to_hotel


class FakeHotel:
    def __init__(self, code="H1", webhook_url="http://hotelsim:8090/webhook", hmac_secret="s3cr3t"):
        self.code = code
        self.webhook_url = webhook_url
        self.hmac_secret = hmac_secret


def test_build_outbound_event_shape():
    ev = build_outbound_event("H1", "booking_cancelled", {"externalBookingId": "x1"}, revision=2)
    assert ev["type"] == "booking_cancelled"
    assert ev["origin"] == "PMS"
    assert ev["hotelCode"] == "H1"
    assert ev["revision"] == 2
    assert ev["data"] == {"externalBookingId": "x1"}
    assert "eventId" in ev


def test_publish_signs_and_posts_to_webhook():
    captured = {}

    def fake_poster(url, *, content, headers):
        captured["url"] = url
        captured["content"] = content
        captured["headers"] = headers
        return 200

    hotel = FakeHotel()
    status = publish_to_hotel(hotel, "booking_cancelled", {"externalBookingId": "x1"}, poster=fake_poster)

    assert status == "sent"
    assert captured["url"] == "http://hotelsim:8090/webhook"
    sig = captured["headers"]["X-NextStay-Signature"]
    assert verify_signature(captured["content"], hotel.hmac_secret, sig) is True
    body = json.loads(captured["content"])
    assert body["type"] == "booking_cancelled"
    assert body["origin"] == "PMS"


def test_publish_skips_when_no_webhook_url():
    hotel = FakeHotel(webhook_url=None)
    called = False

    def fake_poster(url, *, content, headers):
        nonlocal called
        called = True
        return 200

    status = publish_to_hotel(hotel, "booking_cancelled", {"externalBookingId": "x1"}, poster=fake_poster)
    assert status == "skipped"
    assert called is False
