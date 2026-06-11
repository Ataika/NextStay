"""Build, sign, and POST hotel-sim events to the NextStay PMS inbound endpoint."""

import json
import time
import uuid

import httpx

from hotelsim import config
from hotelsim.signing import sign_payload

_TIMEOUT = 10.0


def build_event(
    event_type: str,
    *,
    external_booking_id: str,
    room_number: str | None = None,
    guest_name: str | None = None,
    guest_email: str | None = None,
    check_in: str | None = None,
    check_out: str | None = None,
    amount_paid: float | None = None,
) -> dict:
    event = {
        "eventId": f"hsim-{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}",
        "hotelId": config.HOTEL_ID,
        "source": "hotel_site_simulator",
        "type": event_type,
        "origin": "HOTEL",
        "externalBookingId": external_booking_id,
    }
    if event_type == "booking_created":
        event.update(
            {
                "roomNumber": room_number,
                "guestName": guest_name,
                "guestEmail": guest_email,
                "checkIn": check_in,
                "checkOut": check_out,
                "amountPaid": amount_paid,
            }
        )
    return event


def _default_poster(url: str, *, content: bytes, headers: dict):
    resp = httpx.post(url, content=content, headers=headers, timeout=_TIMEOUT)
    return resp.status_code, resp.text


def send_event(
    event: dict, *, secret: str | None = None, token: str | None = None, base_url: str | None = None, poster=None
):
    """Sign and POST an event to PMS. Returns (status_code, response_text)."""
    secret = secret if secret is not None else config.HMAC_SECRET
    token = token if token is not None else config.SYNC_TOKEN
    base_url = base_url if base_url is not None else config.PMS_BASE_URL
    poster = poster or _default_poster

    url = f"{base_url.rstrip('/')}/hotel-sync/events"
    content = json.dumps(event).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "X-Hotel-Sync-Token": token,
        "X-NextStay-Signature": sign_payload(content, secret),
    }
    return poster(url, content=content, headers=headers)
