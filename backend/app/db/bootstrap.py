from __future__ import annotations

import logging
from pathlib import Path

from app.db.base import Base
from app.db.session import engine

LOGGER = logging.getLogger(__name__)
MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"
MIGRATION_ORDER = [
    "add_users_and_auth_sessions.sql",
    "add_email_otps.sql",
    "add_stripe_fields.sql",
    "add_hotel_profile.sql",
    "add_chat_messages.sql",
    "add_chat_conversations.sql",
    "add_chat_wallpaper_to_users.sql",
    "add_password_hash_to_users.sql",
    "add_preferred_language_to_users.sql",
]


def _ordered_migration_paths() -> list[Path]:
    paths: list[Path] = []

    for filename in MIGRATION_ORDER:
        path = MIGRATIONS_DIR / filename
        if path.exists():
            paths.append(path)

    remaining_paths = sorted(path for path in MIGRATIONS_DIR.glob("*.sql") if path not in paths)
    return paths + remaining_paths


def _apply_sql_migration(path: Path) -> None:
    sql = path.read_text(encoding="utf-8").strip()
    if not sql:
        return

    raw_connection = engine.raw_connection()
    try:
        with raw_connection.cursor() as cursor:
            cursor.execute(sql)
        raw_connection.commit()
        LOGGER.info("Applied SQL migration %s", path.name)
    except Exception:
        raw_connection.rollback()
        LOGGER.exception("Failed to apply SQL migration %s", path.name)
        raise
    finally:
        raw_connection.close()


def prepare_database() -> None:
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    if not MIGRATIONS_DIR.exists():
        LOGGER.warning("Migration directory not found: %s", MIGRATIONS_DIR)
        return

    for path in _ordered_migration_paths():
        _apply_sql_migration(path)
