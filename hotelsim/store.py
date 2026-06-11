"""SQLite-backed local store for the hotel simulator (rooms, bookings, inbound events)."""

import secrets
import sqlite3


class Store:
    def __init__(self, db_path: str):
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row

    def init_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS rooms (
                number TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                price REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'Available'
            );
            CREATE TABLE IF NOT EXISTS bookings (
                external_id TEXT PRIMARY KEY,
                room_number TEXT NOT NULL,
                guest_name TEXT NOT NULL,
                guest_email TEXT,
                check_in TEXT NOT NULL,
                check_out TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS inbound_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                received_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            """
        )
        self._conn.commit()

    def seed_rooms(self, rooms: list[tuple[str, str, float]]) -> None:
        self._conn.executemany("INSERT OR REPLACE INTO rooms (number, category, price) VALUES (?, ?, ?)", rooms)
        self._conn.commit()

    def list_rooms(self) -> list[dict]:
        return [dict(r) for r in self._conn.execute("SELECT * FROM rooms ORDER BY number").fetchall()]

    def create_booking(self, room_number, guest_name, guest_email, check_in, check_out) -> str:
        external_id = f"hsim-{secrets.token_urlsafe(8)}"
        self._conn.execute(
            "INSERT INTO bookings (external_id, room_number, guest_name, guest_email, check_in, check_out) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (external_id, room_number, guest_name, guest_email, check_in, check_out),
        )
        self._conn.execute("UPDATE rooms SET status = 'Booked' WHERE number = ?", (room_number,))
        self._conn.commit()
        return external_id

    def get_booking(self, external_id: str) -> dict | None:
        row = self._conn.execute("SELECT * FROM bookings WHERE external_id = ?", (external_id,)).fetchone()
        return dict(row) if row else None

    def list_bookings(self) -> list[dict]:
        return [dict(r) for r in self._conn.execute("SELECT * FROM bookings ORDER BY created_at DESC").fetchall()]

    def cancel_booking(self, external_id: str) -> bool:
        booking = self.get_booking(external_id)
        if not booking:
            return False
        self._conn.execute("UPDATE bookings SET status = 'cancelled' WHERE external_id = ?", (external_id,))
        self._conn.execute("UPDATE rooms SET status = 'Available' WHERE number = ?", (booking["room_number"],))
        self._conn.commit()
        return True

    def apply_inbound_event(self, event: dict) -> None:
        import json as _json

        self._conn.execute(
            "INSERT INTO inbound_events (event_type, payload) VALUES (?, ?)",
            (event.get("type", "unknown"), _json.dumps(event)),
        )
        data = event.get("data", {})
        ext_id = data.get("externalBookingId")
        if event.get("type") == "booking_cancelled" and ext_id:
            self.cancel_booking(ext_id)
        self._conn.commit()

    def list_inbound_events(self) -> list[dict]:
        return [
            dict(r) for r in self._conn.execute("SELECT * FROM inbound_events ORDER BY received_at DESC").fetchall()
        ]

    def close(self) -> None:
        self._conn.close()
