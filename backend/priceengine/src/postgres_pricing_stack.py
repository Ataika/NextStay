import os
import re
from collections.abc import Iterable

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

VALID_TABLE_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$")


STACK_DDL_STATEMENTS = [
    "CREATE SCHEMA IF NOT EXISTS ml",
    "CREATE SCHEMA IF NOT EXISTS pricing",
    """
    CREATE TABLE IF NOT EXISTS core.dim_hotels (
        hotel_sk SERIAL PRIMARY KEY,
        hotel_id INT NOT NULL,
        hotel_name VARCHAR(120) NOT NULL,
        hotel_segment VARCHAR(50) NOT NULL,
        timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Rome',
        city VARCHAR(100),
        country_code VARCHAR(2) NOT NULL DEFAULT 'IT',
        valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        valid_to TIMESTAMPTZ,
        is_current BOOLEAN NOT NULL DEFAULT TRUE
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_dim_hotels_hotel_id_current ON core.dim_hotels(hotel_id, is_current)",
    """
    CREATE TABLE IF NOT EXISTS core.dim_room_types (
        room_type_sk SERIAL PRIMARY KEY,
        room_type_id INT NOT NULL,
        hotel_sk INT NOT NULL REFERENCES core.dim_hotels(hotel_sk) ON DELETE CASCADE,
        room_type_name VARCHAR(100) NOT NULL,
        category VARCHAR(100) NOT NULL,
        max_occupancy INT NOT NULL,
        base_price_default NUMERIC(10, 2) NOT NULL,
        sea_view_flag BOOLEAN NOT NULL DEFAULT FALSE,
        balcony_flag BOOLEAN NOT NULL DEFAULT FALSE,
        amenity_score NUMERIC(10, 2),
        is_current BOOLEAN NOT NULL DEFAULT TRUE,
        valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        valid_to TIMESTAMPTZ
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_dim_room_types_hotel_room_type
    ON core.dim_room_types(hotel_sk, room_type_id, is_current)
    """,
    """
    CREATE TABLE IF NOT EXISTS core.fact_pricing_snapshots (
        snapshot_sk BIGSERIAL PRIMARY KEY,
        hotel_sk INT NOT NULL REFERENCES core.dim_hotels(hotel_sk),
        room_type_sk INT NOT NULL REFERENCES core.dim_room_types(room_type_sk),
        snapshot_date_sk INT NOT NULL REFERENCES core.dim_dates(date_sk),
        stay_date_sk INT NOT NULL REFERENCES core.dim_dates(date_sk),
        lead_time INT NOT NULL,
        total_inventory INT NOT NULL,
        booked_rooms INT NOT NULL,
        available_rooms INT NOT NULL,
        occupancy_rate NUMERIC(8, 4) NOT NULL,
        base_price NUMERIC(10, 2) NOT NULL,
        offered_price NUMERIC(10, 2) NOT NULL,
        final_price NUMERIC(10, 2),
        booking_made SMALLINT NOT NULL DEFAULT 0,
        rooms_booked INT NOT NULL DEFAULT 0,
        cancellation SMALLINT NOT NULL DEFAULT 0,
        refundable_rate_flag SMALLINT NOT NULL DEFAULT 0,
        breakfast_included_flag SMALLINT NOT NULL DEFAULT 0,
        competitor_price NUMERIC(10, 2),
        event_score NUMERIC(10, 2),
        search_volume NUMERIC(12, 2),
        location_demand_index NUMERIC(12, 2),
        is_holiday SMALLINT NOT NULL DEFAULT 0,
        source_batch_id VARCHAR(80) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_fact_pricing_snapshots_lookup
    ON core.fact_pricing_snapshots(hotel_sk, room_type_sk, stay_date_sk, snapshot_date_sk)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_fact_pricing_snapshots_batch
    ON core.fact_pricing_snapshots(source_batch_id)
    """,
    """
    CREATE TABLE IF NOT EXISTS ml.pricingdata (
        hotel_id INT NOT NULL,
        hotel_segment VARCHAR(50) NOT NULL,
        room_type_id INT NOT NULL,
        room_type_name VARCHAR(100) NOT NULL,
        snapshot_date DATE NOT NULL,
        stay_date DATE NOT NULL,
        lead_time INT NOT NULL,
        day_of_week VARCHAR(20) NOT NULL,
        week_of_year INT NOT NULL,
        month INT NOT NULL,
        year INT NOT NULL,
        season VARCHAR(20) NOT NULL,
        is_weekend SMALLINT NOT NULL,
        is_holiday SMALLINT NOT NULL,
        total_inventory INT NOT NULL,
        booked_rooms INT NOT NULL,
        available_rooms INT NOT NULL,
        occupancy_rate NUMERIC(8, 4) NOT NULL,
        base_price NUMERIC(10, 2) NOT NULL,
        offered_price NUMERIC(10, 2) NOT NULL,
        final_price NUMERIC(10, 2),
        booking_made SMALLINT NOT NULL DEFAULT 0,
        rooms_booked INT NOT NULL DEFAULT 0,
        cancellation SMALLINT NOT NULL DEFAULT 0,
        max_occupancy INT NOT NULL,
        refundable_rate_flag SMALLINT NOT NULL DEFAULT 0,
        breakfast_included_flag SMALLINT NOT NULL DEFAULT 0,
        competitor_price NUMERIC(10, 2),
        event_score NUMERIC(10, 2),
        search_volume NUMERIC(12, 2),
        sea_view_flag SMALLINT,
        balcony_flag SMALLINT,
        amenity_score NUMERIC(10, 2),
        location_demand_index NUMERIC(12, 2),
        feature_schema_version VARCHAR(50) NOT NULL,
        source_batch_id VARCHAR(80) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_ml_pricingdata_lookup
    ON ml.pricingdata(hotel_id, room_type_id, stay_date, snapshot_date)
    """,
    "CREATE INDEX IF NOT EXISTS idx_ml_pricingdata_batch ON ml.pricingdata(source_batch_id)",
    """
    CREATE TABLE IF NOT EXISTS pricing.inventory_snapshots (
        hotel_id INT NOT NULL,
        hotel_segment VARCHAR(50) NOT NULL,
        room_type_id INT NOT NULL,
        room_type_name VARCHAR(100) NOT NULL,
        snapshot_date DATE NOT NULL,
        stay_date DATE NOT NULL,
        lead_time INT NOT NULL,
        day_of_week VARCHAR(20),
        month INT,
        season VARCHAR(20),
        is_weekend SMALLINT,
        is_holiday SMALLINT,
        total_inventory INT,
        booked_rooms INT,
        available_rooms INT,
        occupancy_rate NUMERIC(8, 4),
        base_price NUMERIC(10, 2),
        offered_price NUMERIC(10, 2),
        final_price NUMERIC(10, 2),
        booking_made SMALLINT,
        rooms_booked INT,
        cancellation SMALLINT,
        max_occupancy INT,
        refundable_rate_flag SMALLINT,
        breakfast_included_flag SMALLINT,
        competitor_price NUMERIC(10, 2),
        event_score NUMERIC(10, 2),
        search_volume NUMERIC(12, 2),
        sea_view_flag NUMERIC(10, 2),
        balcony_flag NUMERIC(10, 2),
        amenity_score NUMERIC(10, 2),
        location_demand_index NUMERIC(12, 2),
        source_batch_id VARCHAR(80) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_lookup
    ON pricing.inventory_snapshots(hotel_id, room_type_id, stay_date, snapshot_date)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_batch
    ON pricing.inventory_snapshots(source_batch_id)
    """,
    """
    CREATE TABLE IF NOT EXISTS pricing.price_decisions (
        hotel_id INT NOT NULL,
        room_type_id INT NOT NULL,
        stay_date DATE NOT NULL,
        snapshot_date DATE NOT NULL,
        offered_price NUMERIC(10, 2) NOT NULL,
        predicted_probability NUMERIC(10, 6) NOT NULL,
        expected_revenue NUMERIC(12, 4) NOT NULL,
        booking_made SMALLINT,
        cancellation SMALLINT,
        optimized_price NUMERIC(10, 2) NOT NULL,
        optimized_probability NUMERIC(10, 6) NOT NULL,
        optimized_expected_revenue NUMERIC(12, 4) NOT NULL,
        rule_adjustments JSONB,
        model_version VARCHAR(120) NOT NULL,
        rules_version VARCHAR(120) NOT NULL,
        in_rollout SMALLINT,
        inference_status VARCHAR(40),
        fallback_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_batch_id VARCHAR(80)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_price_decisions_lookup
    ON pricing.price_decisions(hotel_id, room_type_id, stay_date, snapshot_date)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_price_decisions_batch
    ON pricing.price_decisions(source_batch_id)
    """,
    """
    CREATE TABLE IF NOT EXISTS pricing.published_prices (
        hotel_id INT NOT NULL,
        room_type_id INT NOT NULL,
        stay_date DATE NOT NULL,
        snapshot_date DATE NOT NULL,
        final_price NUMERIC(10, 2) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        in_rollout SMALLINT,
        inference_status VARCHAR(40),
        model_version VARCHAR(120),
        rules_version VARCHAR(120),
        source_batch_id VARCHAR(80)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_published_prices_lookup
    ON pricing.published_prices(hotel_id, room_type_id, stay_date, snapshot_date)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_published_prices_batch
    ON pricing.published_prices(source_batch_id)
    """,
]


def default_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    db_user = os.getenv("DB_USER", "nextstay")
    db_password = os.getenv("DB_PASSWORD", "nextstay")
    db_host = os.getenv("POSTGRES_HOST", os.getenv("DB_HOST", "localhost"))
    db_port = os.getenv("POSTGRES_PORT", os.getenv("DB_PORT", "5433"))
    db_name = os.getenv("DB_NAME", os.getenv("POSTGRES_DB", "nextstay"))
    return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


def create_postgres_engine(database_url: str | None = None) -> Engine:
    return create_engine(database_url or default_database_url(), pool_pre_ping=True)


def validate_table_name(table_name: str) -> str:
    normalized = table_name.strip()
    if not VALID_TABLE_NAME.fullmatch(normalized):
        raise ValueError(f"Unsafe table name: {table_name}")
    return normalized


def split_qualified_name(table_name: str) -> tuple[str | None, str]:
    normalized = validate_table_name(table_name)
    if "." not in normalized:
        return None, normalized
    schema, table = normalized.split(".", 1)
    return schema, table


def ensure_postgres_pricing_stack(engine: Engine) -> None:
    with engine.begin() as connection:
        for statement in STACK_DDL_STATEMENTS:
            connection.exec_driver_sql(statement)


def truncate_tables(engine: Engine, table_names: Iterable[str], restart_identity: bool = False) -> None:
    suffix = " RESTART IDENTITY CASCADE" if restart_identity else " CASCADE"
    with engine.begin() as connection:
        for table_name in table_names:
            qualified = validate_table_name(table_name)
            connection.exec_driver_sql(f"TRUNCATE TABLE {qualified}{suffix}")
