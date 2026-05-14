import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy import text

# Allow running this file as a script from project root.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.features import ensure_required_columns, load_schema  # noqa: E402
from src.minimal_stack_db import get_connection  # noqa: E402
from src.postgres_pricing_stack import (  # noqa: E402
    create_postgres_engine,
    ensure_postgres_pricing_stack,
    truncate_tables,
)


def _load_pricing_rules(rules_path: str) -> dict:
    with open(rules_path, encoding="utf-8") as handle:
        return json.load(handle)


ROOM_TYPE_NORMALIZATION = {
    "standard": "Standard",
    "deluxe": "Deluxe",
    "suite": "Suite",
}

DATE_DIM_INSERT_SQL = text(
    """
    INSERT INTO core.dim_dates (date_day, day_of_week, week_of_year, month, year, is_weekend)
    VALUES (:date_day, :day_of_week, :week_of_year, :month, :year, :is_weekend)
    ON CONFLICT (date_day) DO NOTHING
    """
)

MATERIALIZE_ML_SQL = text(
    """
    INSERT INTO ml.pricingdata (
        hotel_id,
        hotel_segment,
        room_type_id,
        room_type_name,
        snapshot_date,
        stay_date,
        lead_time,
        day_of_week,
        week_of_year,
        month,
        year,
        season,
        is_weekend,
        is_holiday,
        total_inventory,
        booked_rooms,
        available_rooms,
        occupancy_rate,
        base_price,
        offered_price,
        final_price,
        booking_made,
        rooms_booked,
        cancellation,
        max_occupancy,
        refundable_rate_flag,
        breakfast_included_flag,
        competitor_price,
        event_score,
        search_volume,
        sea_view_flag,
        balcony_flag,
        amenity_score,
        location_demand_index,
        feature_schema_version,
        source_batch_id,
        created_at
    )
    SELECT
        h.hotel_id,
        h.hotel_segment,
        rt.room_type_id,
        rt.room_type_name,
        snapshot_dim.date_day AS snapshot_date,
        stay_dim.date_day AS stay_date,
        fps.lead_time,
        trim(to_char(stay_dim.date_day, 'Day')) AS day_of_week,
        stay_dim.week_of_year,
        stay_dim.month,
        stay_dim.year,
        CASE
            WHEN stay_dim.month IN (12, 1, 2) THEN 'winter'
            WHEN stay_dim.month IN (3, 4, 5) THEN 'spring'
            WHEN stay_dim.month IN (6, 7, 8) THEN 'summer'
            ELSE 'autumn'
        END AS season,
        CASE WHEN stay_dim.is_weekend THEN 1 ELSE 0 END AS is_weekend,
        fps.is_holiday,
        fps.total_inventory,
        fps.booked_rooms,
        fps.available_rooms,
        fps.occupancy_rate,
        fps.base_price,
        fps.offered_price,
        fps.final_price,
        fps.booking_made,
        fps.rooms_booked,
        fps.cancellation,
        rt.max_occupancy,
        fps.refundable_rate_flag,
        fps.breakfast_included_flag,
        fps.competitor_price,
        fps.event_score,
        fps.search_volume,
        CASE WHEN rt.sea_view_flag THEN 1 ELSE 0 END AS sea_view_flag,
        CASE WHEN rt.balcony_flag THEN 1 ELSE 0 END AS balcony_flag,
        rt.amenity_score,
        fps.location_demand_index,
        :feature_schema_version,
        fps.source_batch_id,
        fps.created_at
    FROM core.fact_pricing_snapshots fps
    INNER JOIN core.dim_hotels h ON h.hotel_sk = fps.hotel_sk
    INNER JOIN core.dim_room_types rt ON rt.room_type_sk = fps.room_type_sk
    INNER JOIN core.dim_dates snapshot_dim ON snapshot_dim.date_sk = fps.snapshot_date_sk
    INNER JOIN core.dim_dates stay_dim ON stay_dim.date_sk = fps.stay_date_sk
    WHERE fps.source_batch_id = :source_batch_id
    """
)

MATERIALIZE_INVENTORY_SQL = text(
    """
    INSERT INTO pricing.inventory_snapshots (
        hotel_id,
        hotel_segment,
        room_type_id,
        room_type_name,
        snapshot_date,
        stay_date,
        lead_time,
        day_of_week,
        month,
        season,
        is_weekend,
        is_holiday,
        total_inventory,
        booked_rooms,
        available_rooms,
        occupancy_rate,
        base_price,
        offered_price,
        final_price,
        booking_made,
        rooms_booked,
        cancellation,
        max_occupancy,
        refundable_rate_flag,
        breakfast_included_flag,
        competitor_price,
        event_score,
        search_volume,
        sea_view_flag,
        balcony_flag,
        amenity_score,
        location_demand_index,
        source_batch_id,
        created_at
    )
    SELECT
        hotel_id,
        hotel_segment,
        room_type_id,
        room_type_name,
        snapshot_date,
        stay_date,
        lead_time,
        day_of_week,
        month,
        season,
        is_weekend,
        is_holiday,
        total_inventory,
        booked_rooms,
        available_rooms,
        occupancy_rate,
        base_price,
        offered_price,
        final_price,
        booking_made,
        rooms_booked,
        cancellation,
        max_occupancy,
        refundable_rate_flag,
        breakfast_included_flag,
        competitor_price,
        event_score,
        search_volume,
        sea_view_flag,
        balcony_flag,
        amenity_score,
        location_demand_index,
        source_batch_id,
        created_at
    FROM ml.pricingdata
    WHERE source_batch_id = :source_batch_id
    """
)


def _normalize_room_type_name(value: str) -> str:
    cleaned = value.strip().lower()
    return ROOM_TYPE_NORMALIZATION.get(cleaned, cleaned.title())


def _load_raw_input_dataframe_from_csv(input_csv: str, limit: int) -> pd.DataFrame:
    df = pd.read_csv(input_csv)
    if limit and limit > 0:
        df = df.head(limit).copy()
    return df


def _load_raw_input_dataframe_from_sqlite(input_sqlite_db: str, limit: int) -> pd.DataFrame:
    conn = get_connection(input_sqlite_db)
    try:
        sql = "SELECT * FROM inventory_snapshots ORDER BY hotel_id, room_type_id, stay_date, snapshot_date"
        if limit and limit > 0:
            sql += f" LIMIT {int(limit)}"
        return pd.read_sql_query(sql, conn)
    finally:
        conn.close()


def _prepare_input_dataframe(
    raw_df: pd.DataFrame,
    schema_path: str,
    source_batch_id: str,
    valid_hotel_segments: set[str],
) -> pd.DataFrame:
    schema = load_schema(schema_path)
    df = raw_df.copy()

    ensure_required_columns(df, schema, include_target=True)

    df["hotel_segment"] = df["hotel_segment"].astype(str).str.strip().str.lower()
    invalid_segments = sorted(set(df["hotel_segment"]) - valid_hotel_segments)
    if invalid_segments:
        raise ValueError(f"Unsupported hotel segments found: {', '.join(invalid_segments)}")

    df["room_type_name"] = df["room_type_name"].astype(str).map(_normalize_room_type_name)
    df["snapshot_date"] = pd.to_datetime(df["snapshot_date"]).dt.date
    df["stay_date"] = pd.to_datetime(df["stay_date"]).dt.date
    df["lead_time"] = (pd.to_datetime(df["stay_date"]) - pd.to_datetime(df["snapshot_date"])).dt.days.astype(int)
    df["booked_rooms"] = df["booked_rooms"].fillna(0).astype(int)
    df["total_inventory"] = df["total_inventory"].fillna(0).astype(int)
    df["available_rooms"] = (df["total_inventory"] - df["booked_rooms"]).clip(lower=0).astype(int)
    df["occupancy_rate"] = df["booked_rooms"].div(df["total_inventory"].replace({0: pd.NA})).fillna(0.0).round(4)

    flag_columns = [
        "is_weekend",
        "is_holiday",
        "booking_made",
        "cancellation",
        "refundable_rate_flag",
        "breakfast_included_flag",
    ]
    for column in flag_columns:
        df[column] = df[column].fillna(0).astype(int)

    df["rooms_booked"] = df["rooms_booked"].fillna(0).astype(int)
    df["source_batch_id"] = source_batch_id
    df["created_at"] = datetime.now(timezone.utc)
    return df


def _upsert_date_dimension(engine, df: pd.DataFrame) -> None:
    unique_dates = sorted(set(df["snapshot_date"].tolist()) | set(df["stay_date"].tolist()))
    date_rows = []
    for current_date in unique_dates:
        date_rows.append(
            {
                "date_day": current_date,
                "day_of_week": current_date.isoweekday(),
                "week_of_year": int(current_date.isocalendar().week),
                "month": current_date.month,
                "year": current_date.year,
                "is_weekend": current_date.weekday() >= 5,
            }
        )

    with engine.begin() as connection:
        connection.execute(DATE_DIM_INSERT_SQL, date_rows)


def _build_hotels_dataframe(
    df: pd.DataFrame,
    valid_from: datetime,
    hotel_metadata: dict,
) -> pd.DataFrame:
    hotels_df = df[["hotel_id", "hotel_segment"]].drop_duplicates().sort_values(["hotel_id"]).copy()
    hotels_df["hotel_name"] = hotels_df["hotel_segment"].map(
        lambda segment: hotel_metadata.get(segment, {}).get("hotel_name", f"NextStay Hotel {segment.title()}")
    )
    hotels_df["timezone"] = hotels_df["hotel_segment"].map(
        lambda segment: hotel_metadata.get(segment, {}).get("timezone", "Europe/Rome")
    )
    hotels_df["city"] = hotels_df["hotel_segment"].map(
        lambda segment: hotel_metadata.get(segment, {}).get("city", "Rome")
    )
    hotels_df["country_code"] = hotels_df["hotel_segment"].map(
        lambda segment: hotel_metadata.get(segment, {}).get("country_code", "IT")
    )
    hotels_df["valid_from"] = valid_from
    hotels_df["valid_to"] = pd.NaT
    hotels_df["is_current"] = True
    return hotels_df


def _build_room_types_dataframe(df: pd.DataFrame, hotel_lookup: pd.DataFrame, valid_from: datetime) -> pd.DataFrame:
    room_types_df = (
        df.groupby(["hotel_id", "room_type_id", "room_type_name"], as_index=False)
        .agg(
            max_occupancy=("max_occupancy", "max"),
            base_price_default=("base_price", "median"),
            sea_view_flag=("sea_view_flag", "max"),
            balcony_flag=("balcony_flag", "max"),
            amenity_score=("amenity_score", "max"),
        )
        .copy()
    )
    room_types_df["category"] = room_types_df["room_type_name"]
    room_types_df["base_price_default"] = room_types_df["base_price_default"].round(2)
    room_types_df["sea_view_flag"] = (
        pd.to_numeric(room_types_df["sea_view_flag"], errors="coerce").fillna(0).astype(int).astype(bool)
    )
    room_types_df["balcony_flag"] = (
        pd.to_numeric(room_types_df["balcony_flag"], errors="coerce").fillna(0).astype(int).astype(bool)
    )
    room_types_df["valid_from"] = valid_from
    room_types_df["valid_to"] = pd.NaT
    room_types_df["is_current"] = True
    room_types_df = room_types_df.merge(hotel_lookup, on="hotel_id", how="inner")
    return room_types_df[
        [
            "room_type_id",
            "hotel_sk",
            "room_type_name",
            "category",
            "max_occupancy",
            "base_price_default",
            "sea_view_flag",
            "balcony_flag",
            "amenity_score",
            "is_current",
            "valid_from",
            "valid_to",
        ]
    ]


def _query_dataframe(engine, sql: str) -> pd.DataFrame:
    with engine.begin() as connection:
        return pd.read_sql_query(text(sql), connection)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed the Postgres pricing stack using either the bundled SQLite seed DB or the legacy CSV."
    )
    parser.add_argument("--database-url", default="", help="Postgres database URL. Uses env/default when omitted.")
    parser.add_argument(
        "--input-source",
        choices=("sqlite", "csv"),
        default="sqlite",
        help="Bootstrap source for the pricing seed load.",
    )
    parser.add_argument("--input-csv", default="synthetic_hotel_pricing.csv")
    parser.add_argument(
        "--input-sqlite-db",
        default="data/dpe_demo.db",
        help="SQLite pricing DB used for the DB-first bootstrap path.",
    )
    parser.add_argument("--schema-path", default="configs/feature_schema_v1.json")
    parser.add_argument("--rules-path", default="configs/pricing_rules_v1.json")
    parser.add_argument("--limit", type=int, default=0, help="0 means load the full dataset.")
    parser.add_argument("--batch-id", default="", help="Optional batch id. Auto-generated when omitted.")
    parser.add_argument("--replace", action="store_true", help="Clear pricing stack tables before loading.")
    args = parser.parse_args()

    pricing_rules = _load_pricing_rules(args.rules_path)
    valid_hotel_segments: set[str] = set(pricing_rules.get("segments", {}).keys())
    hotel_metadata: dict = pricing_rules.get("hotel_metadata", {})

    batch_id = args.batch_id.strip() or datetime.now(timezone.utc).strftime("pricing_seed_%Y%m%dT%H%M%SZ")
    if args.input_source == "sqlite":
        raw_df = _load_raw_input_dataframe_from_sqlite(
            input_sqlite_db=args.input_sqlite_db,
            limit=args.limit,
        )
        source_label = f"sqlite:{args.input_sqlite_db}"
    else:
        raw_df = _load_raw_input_dataframe_from_csv(
            input_csv=args.input_csv,
            limit=args.limit,
        )
        source_label = f"csv:{args.input_csv}"

    df = _prepare_input_dataframe(
        raw_df=raw_df,
        schema_path=args.schema_path,
        source_batch_id=batch_id,
        valid_hotel_segments=valid_hotel_segments,
    )

    engine = create_postgres_engine(args.database_url.strip() or None)
    ensure_postgres_pricing_stack(engine)

    if args.replace:
        truncate_tables(
            engine,
            [
                "pricing.published_prices",
                "pricing.price_decisions",
                "pricing.inventory_snapshots",
                "ml.pricingdata",
                "core.fact_pricing_snapshots",
                "core.dim_room_types",
                "core.dim_hotels",
            ],
            restart_identity=True,
        )

    _upsert_date_dimension(engine, df)
    valid_from = datetime.now(timezone.utc)

    hotels_df = _build_hotels_dataframe(df, valid_from=valid_from, hotel_metadata=hotel_metadata)
    hotels_df.to_sql("dim_hotels", engine, schema="core", if_exists="append", index=False, method="multi")

    hotel_lookup = _query_dataframe(
        engine,
        """
        SELECT hotel_sk, hotel_id
        FROM core.dim_hotels
        WHERE is_current IS TRUE
        ORDER BY hotel_sk
        """,
    )

    room_types_df = _build_room_types_dataframe(df, hotel_lookup=hotel_lookup, valid_from=valid_from)
    room_types_df.to_sql("dim_room_types", engine, schema="core", if_exists="append", index=False, method="multi")

    room_type_lookup = _query_dataframe(
        engine,
        """
        SELECT
            rt.room_type_sk,
            rt.room_type_id,
            h.hotel_id
        FROM core.dim_room_types rt
        INNER JOIN core.dim_hotels h ON h.hotel_sk = rt.hotel_sk
        WHERE rt.is_current IS TRUE AND h.is_current IS TRUE
        ORDER BY rt.room_type_sk
        """,
    )

    date_lookup = _query_dataframe(
        engine,
        """
        SELECT date_sk, date_day
        FROM core.dim_dates
        ORDER BY date_day
        """,
    )
    date_lookup["date_day"] = pd.to_datetime(date_lookup["date_day"]).dt.date

    fact_df = df.merge(hotel_lookup, on="hotel_id", how="inner")
    fact_df = fact_df.merge(room_type_lookup, on=["hotel_id", "room_type_id"], how="inner")
    fact_df = fact_df.merge(
        date_lookup.rename(columns={"date_sk": "snapshot_date_sk"}),
        left_on="snapshot_date",
        right_on="date_day",
        how="inner",
    )
    fact_df = fact_df.merge(
        date_lookup.rename(columns={"date_sk": "stay_date_sk"}),
        left_on="stay_date",
        right_on="date_day",
        how="inner",
        suffixes=("_snapshot", "_stay"),
    )

    fact_output = fact_df[
        [
            "hotel_sk",
            "room_type_sk",
            "snapshot_date_sk",
            "stay_date_sk",
            "lead_time",
            "total_inventory",
            "booked_rooms",
            "available_rooms",
            "occupancy_rate",
            "base_price",
            "offered_price",
            "final_price",
            "booking_made",
            "rooms_booked",
            "cancellation",
            "refundable_rate_flag",
            "breakfast_included_flag",
            "competitor_price",
            "event_score",
            "search_volume",
            "location_demand_index",
            "is_holiday",
            "source_batch_id",
            "created_at",
        ]
    ].copy()
    fact_output.to_sql(
        "fact_pricing_snapshots",
        engine,
        schema="core",
        if_exists="append",
        index=False,
        chunksize=5000,
        method="multi",
    )

    with engine.begin() as connection:
        connection.execute(
            MATERIALIZE_ML_SQL,
            {"feature_schema_version": load_schema(args.schema_path)["schema_version"], "source_batch_id": batch_id},
        )
        connection.execute(MATERIALIZE_INVENTORY_SQL, {"source_batch_id": batch_id})

    with engine.begin() as connection:
        counts = {
            "core.dim_hotels": connection.execute(text("SELECT COUNT(*) FROM core.dim_hotels")).scalar_one(),
            "core.dim_room_types": connection.execute(text("SELECT COUNT(*) FROM core.dim_room_types")).scalar_one(),
            "core.fact_pricing_snapshots": connection.execute(
                text("SELECT COUNT(*) FROM core.fact_pricing_snapshots")
            ).scalar_one(),
            "ml.pricingdata": connection.execute(text("SELECT COUNT(*) FROM ml.pricingdata")).scalar_one(),
            "pricing.inventory_snapshots": connection.execute(
                text("SELECT COUNT(*) FROM pricing.inventory_snapshots")
            ).scalar_one(),
        }

    print(f"Batch id: {batch_id}")
    print(f"Seed source: {source_label}")
    print(f"Loaded source rows: {len(df)}")
    for table_name, row_count in counts.items():
        print(f"{table_name}: {row_count}")


if __name__ == "__main__":
    main()
