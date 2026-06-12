from hotelsim.generator import choose_action
from hotelsim.store import Store


def _store():
    s = Store(":memory:")
    s.init_schema()
    s.seed_rooms([("101", "Standard", 100.0)])
    return s


def test_choose_action_books_when_rooms_available():
    s = _store()
    action = choose_action(s, rng_value=0.0)  # low value → book
    assert action["kind"] == "book"
    assert action["roomNumber"] == "101"


def test_choose_action_cancels_when_active_booking_and_high_rng():
    s = _store()
    s.create_booking("101", "G", "g@x.com", "2026-07-01", "2026-07-03")
    action = choose_action(s, rng_value=0.99)  # high value → cancel an active booking
    assert action["kind"] == "cancel"


def test_choose_action_noop_when_nothing_to_do():
    s = Store(":memory:")
    s.init_schema()  # no rooms
    action = choose_action(s, rng_value=0.0)
    assert action["kind"] == "noop"
