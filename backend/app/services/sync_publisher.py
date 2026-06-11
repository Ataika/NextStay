"""Outbound hotel-sync publisher: push PMS-originated changes back to a hotel.

`publish_to_hotel` signs the JSON envelope with the hotel's HMAC secret and
POSTs it to the hotel's webhook URL. The HTTP call is injected via `poster`
so it can be faked in tests; the default uses httpx.

Anti-echo is the caller's responsibility: only call this for PMS-originated
changes (see `should_publish_outbound`). Events ingested FROM a hotel must
not be re-published.
"""

import json
import uuid

import httpx
from app.core.hotel_sync_security import sign_payload
from app.core.logging import get_logger

logger = get_logger(__name__)

_TIMEOUT_SECONDS = 5.0


def build_outbound_event(hotel_code: str, event_type: str, data: dict, *, revision: int = 0) -> dict:
    return {
        "eventId": str(uuid.uuid4()),
        "type": event_type,
        "origin": "PMS",
        "hotelCode": hotel_code,
        "revision": revision,
        "data": data,
    }


def _default_poster(url: str, *, content: bytes, headers: dict) -> int:
    response = httpx.post(url, content=content, headers=headers, timeout=_TIMEOUT_SECONDS)
    return response.status_code


def publish_to_hotel(hotel, event_type: str, data: dict, *, revision: int = 0, poster=None) -> str:
    """Sign and POST an outbound event to the hotel's webhook.

    Returns 'sent', 'skipped' (no webhook configured), or 'failed'.
    """
    if not getattr(hotel, "webhook_url", None):
        return "skipped"

    poster = poster or _default_poster
    event = build_outbound_event(hotel.code, event_type, data, revision=revision)
    content = json.dumps(event).encode("utf-8")
    secret = getattr(hotel, "hmac_secret", None) or ""
    headers = {
        "Content-Type": "application/json",
        "X-NextStay-Signature": sign_payload(content, secret),
    }
    try:
        status_code = poster(hotel.webhook_url, content=content, headers=headers)
    except Exception:
        logger.warning("Outbound hotel-sync publish failed for hotel %s", hotel.code, exc_info=True)
        return "failed"
    if 200 <= status_code < 300:
        return "sent"
    logger.warning("Hotel %s webhook returned status %s", hotel.code, status_code)
    return "failed"
