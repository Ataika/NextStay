"""Traffic generator for the hotel simulator: periodically books/cancels rooms."""

import asyncio

from hotelsim import config
from hotelsim.pms_client import build_event, send_event


def choose_action(store, rng_value: float) -> dict:
    """Pure decision function. rng_value in [0,1). Returns an action dict.

    Low rng → book an available room; high rng → cancel an active booking.
    Falls back to the other action or 'noop' when one isn't possible.
    """
    available = [r for r in store.list_rooms() if r["status"] == "Available"]
    active = [b for b in store.list_bookings() if b["status"] == "active"]
    want_cancel = rng_value >= 0.5
    if want_cancel and active:
        return {"kind": "cancel", "externalBookingId": active[0]["external_id"]}
    if available:
        return {"kind": "book", "roomNumber": available[0]["number"]}
    if active:
        return {"kind": "cancel", "externalBookingId": active[0]["external_id"]}
    return {"kind": "noop"}


def apply_action(store, action: dict) -> None:
    if action["kind"] == "book":
        ext_id = store.create_booking(
            action["roomNumber"],
            "Auto Guest",
            "auto@example.com",
            "2026-07-01T14:00:00Z",
            "2026-07-03T12:00:00Z",
        )
        send_event(
            build_event(
                "booking_created",
                external_booking_id=ext_id,
                room_number=action["roomNumber"],
                guest_name="Auto Guest",
                guest_email="auto@example.com",
                check_in="2026-07-01T14:00:00Z",
                check_out="2026-07-03T12:00:00Z",
                amount_paid=160.0,
            )
        )
    elif action["kind"] == "cancel":
        store.cancel_booking(action["externalBookingId"])
        send_event(build_event("booking_cancelled", external_booking_id=action["externalBookingId"]))


async def run(store, *, interval_seconds: float = 20.0) -> None:  # pragma: no cover
    import random

    while True:
        apply_action(store, choose_action(store, random.random()))
        await asyncio.sleep(interval_seconds)


_ = config  # reserved for future per-hotel config
