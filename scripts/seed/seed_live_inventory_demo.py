import os
import random
import subprocess
import sys
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

import psycopg2
from psycopg2.extras import Json, execute_values

REPO_ROOT = Path(__file__).resolve().parents[2]
PRICEENGINE_ROOT = REPO_ROOT / "backend" / "priceengine"

ROOM_COUNTS = {"Standard": 50, "Deluxe": 30, "Suite": 20}
OCCUPIED_COUNTS = {"Standard": 15, "Deluxe": 10, "Suite": 5}
ROOM_TYPE_IDS = {"Standard": 1, "Deluxe": 2, "Suite": 3}
REFUNDABLE_FLAGS = {"Standard": 0, "Deluxe": 1, "Suite": 1}
BREAKFAST_FLAGS = {"Standard": 0, "Deluxe": 1, "Suite": 1}
HOTEL_ID = 1
HOTEL_SEGMENT = "budget_city"


@dataclass
class DemoRoom:
    number: str
    category: str
    status: str
    price: float
    capacity: int
    description: str
    amenities: list[str]
    sea_view: int
    balcony: int


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


def generate_room(room_index: int, category: str, rng: random.Random) -> DemoRoom:
    floor = ((room_index - 1) // 10) + 1
    room_on_floor = ((room_index - 1) % 10) + 1
    room_number = f"{floor}{room_on_floor:02d}"

    if category == "Standard":
        base_price = 92 + floor * 2 + rng.randint(0, 12)
        capacity = 2
        amenities = ["Wi-Fi", "Smart TV", "Air Conditioning", "Desk"]
    elif category == "Deluxe":
        base_price = 148 + floor * 3 + rng.randint(0, 18)
        capacity = 3
        amenities = ["Wi-Fi", "Smart TV", "Air Conditioning", "Desk", "Mini Bar"]
    else:
        base_price = 258 + floor * 4 + rng.randint(0, 28)
        capacity = 4
        amenities = ["Wi-Fi", "Smart TV", "Air Conditioning", "Desk", "Mini Bar", "Lounge Area"]

    sea_view = int(floor >= 8 and room_on_floor in {1, 2, 9, 10})
    balcony = int(category != "Standard" and room_on_floor in {3, 4, 7, 8})
    if sea_view:
        amenities.append("Sea View")
        base_price += 18
    if balcony:
        amenities.append("Balcony")
        base_price += 12
    if category == "Suite" and "Espresso Machine" not in amenities:
        amenities.append("Espresso Machine")

    description_bits = [category, "room"]
    if sea_view:
        description_bits.append("with sea view")
    elif floor >= 6:
        description_bits.append("with skyline view")
    else:
        description_bits.append("with courtyard view")
    if balcony:
        description_bits.append("and balcony")

    return DemoRoom(
        number=room_number,
        category=category,
        status="Available",
        price=float(base_price),
        capacity=capacity,
        description=" ".join(description_bits).capitalize(),
        amenities=amenities,
        sea_view=sea_view,
        balcony=balcony,
    )


def build_demo_rooms() -> list[DemoRoom]:
    rng = random.Random(42)
    rooms: list[DemoRoom] = []
    room_index = 1
    for category, count in ROOM_COUNTS.items():
        for _ in range(count):
            rooms.append(generate_room(room_index, category, rng))
            room_index += 1

    for category, count in OCCUPIED_COUNTS.items():
        marked = 0
        for room in rooms:
            if room.category == category and marked < count:
                room.status = "Occupied"
                marked += 1
    return rooms


def insert_rooms(cur, rooms: list[DemoRoom]) -> None:
    execute_values(
        cur,
        """
        INSERT INTO rooms (number, category, status, price, capacity, description, amenities)
        VALUES %s
        """,
        [
            (
                room.number,
                room.category,
                room.status,
                room.price,
                room.capacity,
                room.description,
                Json(room.amenities),
            )
            for room in rooms
        ],
    )


def insert_bookings(cur) -> None:
    cur.execute(
        """
        SELECT id, number, category, price
        FROM rooms
        WHERE status = 'Occupied'
        ORDER BY id
        """
    )
    occupied_rooms = cur.fetchall()

    guest_first_names = [
        "Luca",
        "Maya",
        "Noah",
        "Sofia",
        "Daniel",
        "Emma",
        "Ethan",
        "Ava",
        "Leo",
        "Mila",
    ]
    guest_last_names = [
        "Rossi",
        "Carter",
        "Lopez",
        "Khan",
        "Silva",
        "Bianchi",
        "Taylor",
        "Novak",
        "Dubois",
        "Petrov",
    ]

    now = datetime.now(timezone.utc)
    check_in = datetime.combine(now.date(), time(hour=14, tzinfo=timezone.utc))
    bookings = []
    for index, room in enumerate(occupied_rooms, start=1):
        first_name = guest_first_names[index % len(guest_first_names)]
        last_name = guest_last_names[index % len(guest_last_names)]
        guest_name = f"{first_name} {last_name}"
        guest_email = f"guest{index:03d}@demo.nextstay.local"
        nights = 2 + (index % 4)
        check_out = check_in + timedelta(days=nights)
        notes = f"Demo occupied room for {room[2].lower()} inventory scenario"
        bookings.append(
            (
                guest_name,
                guest_email,
                room[0],
                room[1],
                check_in,
                check_out,
                "Checked-in",
                notes,
                round(float(room[3]) * nights, 2),
            )
        )

    execute_values(
        cur,
        """
        INSERT INTO bookings (
            guest_name,
            guest_email,
            room_id,
            room_number,
            check_in,
            check_out,
            status,
            notes,
            amount_paid
        )
        VALUES %s
        """,
        bookings,
    )


def insert_pricing_snapshot(cur, batch_id: str, stay_date: date) -> None:
    cur.execute(
        """
        SELECT
            category,
            COUNT(*) AS total_inventory,
            COUNT(*) FILTER (WHERE status = 'Occupied') AS booked_rooms,
            AVG(price) AS avg_price,
            MAX(capacity) AS max_capacity,
            AVG(
                CASE
                    WHEN amenities::text ILIKE '%Sea View%' THEN 1
                    ELSE 0
                END
            ) AS sea_view_ratio,
            AVG(
                CASE
                    WHEN amenities::text ILIKE '%Balcony%' THEN 1
                    ELSE 0
                END
            ) AS balcony_ratio,
            AVG(jsonb_array_length(amenities)) AS amenity_score
        FROM rooms
        GROUP BY category
        ORDER BY category
        """
    )
    grouped_rows = cur.fetchall()

    snapshot_date = stay_date
    created_at = datetime.now(timezone.utc)
    inventory_rows = []
    for (
        category,
        total_inventory,
        booked_rooms,
        avg_price,
        max_capacity,
        sea_view_ratio,
        balcony_ratio,
        amenity_score,
    ) in grouped_rows:
        category_name = str(category)
        total_inventory = int(total_inventory)
        booked_rooms = int(booked_rooms)
        available_rooms = total_inventory - booked_rooms
        occupancy_rate = round(booked_rooms / total_inventory, 4) if total_inventory else 0.0
        competitor_price = round(float(avg_price) * 1.04, 2)
        event_score = {"Standard": 3.2, "Deluxe": 4.1, "Suite": 4.8}[category_name]
        search_volume = {"Standard": 78.0, "Deluxe": 64.0, "Suite": 42.0}[category_name]

        inventory_rows.append(
            (
                HOTEL_ID,
                HOTEL_SEGMENT,
                ROOM_TYPE_IDS[category_name],
                category_name,
                snapshot_date,
                stay_date,
                0,
                stay_date.strftime("%A"),
                stay_date.month,
                season_for_month(stay_date.month),
                int(stay_date.weekday() >= 5),
                0,
                total_inventory,
                booked_rooms,
                available_rooms,
                occupancy_rate,
                round(float(avg_price), 2),
                round(float(avg_price), 2),
                None,
                0,
                0,
                0,
                int(max_capacity),
                REFUNDABLE_FLAGS[category_name],
                BREAKFAST_FLAGS[category_name],
                competitor_price,
                event_score,
                search_volume,
                round(float(sea_view_ratio or 0.0), 2),
                round(float(balcony_ratio or 0.0), 2),
                round(float(amenity_score or 0.0), 2),
                97.5,
                batch_id,
                created_at,
            )
        )

    cur.execute("TRUNCATE TABLE pricing.published_prices, pricing.price_decisions, pricing.inventory_snapshots CASCADE")
    execute_values(
        cur,
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
        VALUES %s
        """,
        inventory_rows,
    )


def season_for_month(month: int) -> str:
    if month in (12, 1, 2):
        return "winter"
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    return "autumn"


def run_pricing_batch(database_url: str, batch_id: str) -> None:
    command = [
        sys.executable,
        "src/batch_runner.py",
        "--backend",
        "postgres",
        "--database-url",
        database_url,
        "--input-table",
        "pricing.inventory_snapshots",
        "--decisions-table",
        "pricing.price_decisions",
        "--published-table",
        "pricing.published_prices",
        "--schema-path",
        "configs/feature_schema_v1.json",
        "--rules-path",
        "configs/pricing_rules_v1.json",
        "--serving-config",
        "configs/serving_config_v1.json",
        "--replace-output",
        "--source-batch-id",
        batch_id,
    ]
    subprocess.run(command, cwd=PRICEENGINE_ROOT, check=True)


def main() -> None:
    database_url = default_database_url()
    batch_id = datetime.now(timezone.utc).strftime("live_inventory_demo_%Y%m%dT%H%M%SZ")
    stay_date = datetime.now().date()
    rooms = build_demo_rooms()

    with psycopg2.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                TRUNCATE TABLE
                    guest_tokens,
                    cleaning_tasks,
                    bookings,
                    rooms
                RESTART IDENTITY CASCADE
                """
            )
            insert_rooms(cur, rooms)
            insert_bookings(cur)
            insert_pricing_snapshot(cur, batch_id=batch_id, stay_date=stay_date)

    run_pricing_batch(database_url=database_url, batch_id=batch_id)

    print(f"Live inventory demo batch: {batch_id}")
    print("Rooms seeded: 100")
    print("Occupied rooms seeded: 30")
    print("Available rooms seeded: 70")
    print(f"Pricing stay date: {stay_date.isoformat()}")


if __name__ == "__main__":
    main()
