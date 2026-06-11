from datetime import datetime, timezone


def ensure_utc(dt: datetime | None) -> datetime | None:
    """Return dt as a UTC-aware datetime.

    SQLite ignores timezone=True on DateTime columns and returns naive datetimes.
    This converts them to UTC-aware so they can be compared with datetime.now(timezone.utc).
    """
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
