from datetime import datetime, timezone

from app.core.utils import count_stay_nights


def test_count_stay_nights_uses_calendar_dates_not_clock_hours():
    check_in = datetime(2026, 6, 15, 14, 0, tzinfo=timezone.utc)
    check_out = datetime(2026, 6, 16, 12, 0, tzinfo=timezone.utc)
    assert count_stay_nights(check_in, check_out) == 1


def test_count_stay_nights_multi_night_stay():
    check_in = datetime(2026, 6, 15, 14, 0, tzinfo=timezone.utc)
    check_out = datetime(2026, 6, 18, 12, 0, tzinfo=timezone.utc)
    assert count_stay_nights(check_in, check_out) == 3
