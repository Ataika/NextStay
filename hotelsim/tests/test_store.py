def test_seed_and_list_rooms(store):
    store.seed_rooms([("101", "Standard", 100.0), ("102", "Deluxe", 150.0)])
    rooms = store.list_rooms()
    assert {r["number"] for r in rooms} == {"101", "102"}


def test_create_and_cancel_booking(store):
    store.seed_rooms([("101", "Standard", 100.0)])
    ext_id = store.create_booking("101", "Guest A", "a@x.com", "2026-07-01", "2026-07-03")
    assert ext_id
    bk = store.get_booking(ext_id)
    assert bk["status"] == "active"
    assert bk["room_number"] == "101"
    store.cancel_booking(ext_id)
    assert store.get_booking(ext_id)["status"] == "cancelled"


def test_apply_inbound_cancel_marks_local_booking(store):
    store.seed_rooms([("101", "Standard", 100.0)])
    ext_id = store.create_booking("101", "Guest A", "a@x.com", "2026-07-01", "2026-07-03")
    store.apply_inbound_event({"type": "booking_cancelled", "data": {"externalBookingId": ext_id}})
    assert store.get_booking(ext_id)["status"] == "cancelled"
