from datetime import datetime, timezone


def count_stay_nights(check_in: datetime, check_out: datetime) -> int:
    """Count hotel nights by calendar date (15→16 Jun = 1 night), not clock hours."""
    return max(0, (check_out.date() - check_in.date()).days)


def ensure_utc(dt: datetime | None) -> datetime | None:
    """Return dt as a UTC-aware datetime.

    SQLite ignores timezone=True on DateTime columns and returns naive datetimes.
    This converts them to UTC-aware so they can be compared with datetime.now(timezone.utc).
    """
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
