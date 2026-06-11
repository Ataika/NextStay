#!/usr/bin/env python3
"""Send a demo hotel-site booking event into NextStay."""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from datetime import date, timedelta


def default_date(days_from_today: int) -> str:
    return (date.today() + timedelta(days=days_from_today)).isoformat()


def send_event(api_base: str, token: str, payload: dict) -> dict:
    url = f"{api_base.rstrip('/')}/hotel-sync/events"
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Hotel-Sync-Token": token,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8")
        raise SystemExit(f"HTTP {err.code}: {body}") from err


def build_payload(args: argparse.Namespace) -> dict:
    event_prefix = "booking-cancelled" if args.cancel else "booking-created"
    event_type = "booking_cancelled" if args.cancel else "booking_created"
    payload = {
        "eventId": f"{event_prefix}-{int(time.time())}",
        "hotelId": args.hotel_id,
        "source": "hotel_site_simulator_cli",
        "type": event_type,
        "externalBookingId": args.external_booking_id,
    }
    if not args.cancel:
        payload.update(
            {
                "roomNumber": args.room_number,
                "guestName": args.guest_name,
                "guestEmail": args.guest_email,
                "checkIn": f"{args.check_in}T14:00:00Z",
                "checkOut": f"{args.check_out}T12:00:00Z",
                "amountPaid": args.amount_paid,
            }
        )
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulate an external hotel-site booking sync event.")
    parser.add_argument("--api-base", default="http://localhost:8000/api/v1")
    parser.add_argument("--token", default="dev-hotel-sync-token")
    parser.add_argument("--hotel-id", type=int, default=1)
    parser.add_argument("--room-number", default="101")
    parser.add_argument("--external-booking-id", default=f"CLI-{int(time.time())}")
    parser.add_argument("--guest-name", default="CLI Demo Guest")
    parser.add_argument("--guest-email", default="cli.demo@example.com")
    parser.add_argument("--check-in", default=default_date(1))
    parser.add_argument("--check-out", default=default_date(3))
    parser.add_argument("--amount-paid", type=float, default=180.0)
    parser.add_argument("--cancel", action="store_true")
    args = parser.parse_args()

    result = send_event(args.api_base, args.token, build_payload(args))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
