import sqlite3
from pathlib import Path


def get_connection(db_path: str) -> sqlite3.Connection:
    db_file = Path(db_path)
    db_file.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_file)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


def initialize_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS inventory_snapshots (
            hotel_id INTEGER NOT NULL,
            hotel_segment TEXT NOT NULL,
            room_type_id INTEGER NOT NULL,
            room_type_name TEXT NOT NULL,
            snapshot_date TEXT NOT NULL,
            stay_date TEXT NOT NULL,
            lead_time INTEGER NOT NULL,
            day_of_week TEXT,
            month INTEGER,
            season TEXT,
            is_weekend INTEGER,
            is_holiday INTEGER,
            total_inventory INTEGER,
            booked_rooms INTEGER,
            available_rooms INTEGER,
            occupancy_rate REAL,
            base_price REAL,
            offered_price REAL,
            final_price REAL,
            booking_made INTEGER,
            rooms_booked INTEGER,
            cancellation INTEGER,
            max_occupancy INTEGER,
            refundable_rate_flag INTEGER,
            breakfast_included_flag INTEGER,
            competitor_price REAL,
            event_score REAL,
            search_volume REAL,
            sea_view_flag REAL,
            balcony_flag REAL,
            amenity_score REAL,
            location_demand_index REAL
        );

        CREATE INDEX IF NOT EXISTS idx_inventory_hotel_stay
            ON inventory_snapshots(hotel_id, room_type_id, stay_date, snapshot_date);

        CREATE TABLE IF NOT EXISTS price_decisions (
            hotel_id INTEGER NOT NULL,
            room_type_id INTEGER NOT NULL,
            stay_date TEXT NOT NULL,
            snapshot_date TEXT NOT NULL,
            offered_price REAL NOT NULL,
            predicted_probability REAL NOT NULL,
            expected_revenue REAL NOT NULL,
            booking_made INTEGER,
            cancellation INTEGER,
            optimized_price REAL NOT NULL,
            optimized_probability REAL NOT NULL,
            optimized_expected_revenue REAL NOT NULL,
            rule_adjustments TEXT,
            model_version TEXT NOT NULL,
            rules_version TEXT NOT NULL,
            in_rollout INTEGER,
            inference_status TEXT,
            fallback_reason TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_decisions_hotel_stay
            ON price_decisions(hotel_id, room_type_id, stay_date, snapshot_date);

        CREATE TABLE IF NOT EXISTS published_prices (
            hotel_id INTEGER NOT NULL,
            room_type_id INTEGER NOT NULL,
            stay_date TEXT NOT NULL,
            snapshot_date TEXT NOT NULL,
            final_price REAL NOT NULL,
            updated_at TEXT NOT NULL,
            in_rollout INTEGER,
            inference_status TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_published_hotel_stay
            ON published_prices(hotel_id, room_type_id, stay_date, snapshot_date);
        """
    )
    conn.commit()


def clear_table(conn: sqlite3.Connection, table_name: str) -> None:
    conn.execute(f"DELETE FROM {table_name}")
    conn.commit()
