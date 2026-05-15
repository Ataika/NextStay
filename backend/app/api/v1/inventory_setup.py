"""
Inventory Setup API — define room types, create OLTP rooms, generate training datasets.

POST /inventory/setup          — delete all rooms + create new from definition
POST /inventory/generate-dataset — return a synthetic training CSV for download
"""

import csv
import io
import math
import random
from datetime import date, timedelta
from typing import Any

from app.core.config import DEV_OWNER_TOKEN, DEV_OWNER_TOKEN_ENABLED
from app.security.auth import get_current_user, get_db, security
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

router = APIRouter(tags=["inventory-setup"])

RANDOM_SEED = 42
HOLIDAYS = {
    date(2024, 1, 1),
    date(2024, 4, 21),
    date(2024, 5, 1),
    date(2024, 6, 2),
    date(2024, 8, 15),
    date(2024, 12, 25),
    date(2025, 1, 1),
    date(2025, 4, 20),
    date(2025, 5, 1),
    date(2025, 6, 2),
    date(2025, 8, 15),
    date(2025, 12, 25),
    date(2026, 1, 1),
    date(2026, 4, 5),
    date(2026, 5, 1),
    date(2026, 8, 15),
    date(2026, 12, 25),
}
SEASONS = {
    1: "winter",
    2: "winter",
    3: "spring",
    4: "spring",
    5: "spring",
    6: "summer",
    7: "summer",
    8: "summer",
    9: "autumn",
    10: "autumn",
    11: "autumn",
    12: "winter",
}
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SEASON_DEMAND = {
    1: 0.55,
    2: 0.58,
    3: 0.65,
    4: 0.72,
    5: 0.78,
    6: 0.90,
    7: 1.00,
    8: 0.97,
    9: 0.80,
    10: 0.70,
    11: 0.58,
    12: 0.75,
}

SEGMENT_MAP = {
    "Economy": {"segment": "budget_city", "type_id": 1},
    "Standard": {"segment": "budget_city", "type_id": 2},
    "Deluxe": {"segment": "business", "type_id": 3},
    "Suite": {"segment": "beach_resort", "type_id": 4},
    "Penthouse": {"segment": "premium_luxury", "type_id": 5},
}


class RoomTypeConfig(BaseModel):
    name: str = Field(..., description="Room type name e.g. Standard")
    count: int = Field(..., ge=1, le=500)
    base_price: float = Field(..., ge=10.0, le=10000.0)
    capacity: int = Field(default=2, ge=1, le=10)


class InventoryConfig(BaseModel):
    hotel_id: int = Field(default=1)
    hotel_name: str = Field(default="NextStay Hotel")
    room_types: list[RoomTypeConfig] = Field(..., min_length=1, max_length=8)
    rows_per_type: int = Field(default=1200, ge=200, le=5000)


class SetupResult(BaseModel):
    rooms_deleted: int
    rooms_created: int
    room_types: list[str]


def _require_owner(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> Any:
    if DEV_OWNER_TOKEN_ENABLED and credentials is not None and credentials.credentials == DEV_OWNER_TOKEN:
        return {"role": "OWNER"}
    user = get_current_user(credentials=credentials, db=db)
    if user.role.upper() not in ("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"):
        raise HTTPException(status_code=403, detail="Insufficient permissions.")
    return user


def _booking_probability(
    price: float,
    base_price: float,
    occupancy: float,
    lead_time: int,
    is_weekend: int,
    is_holiday: int,
    season_factor: float,
    refundable: int,
) -> float:
    ratio = price / max(base_price, 1.0)
    elasticity = -2.0 if refundable else -1.6
    price_fx = math.exp(elasticity * (ratio - 1.0))
    occ_fx = 0.5 + 0.6 * occupancy
    lead_fx = math.exp(-0.015 * max(lead_time - 7, 0))
    weekend_fx = 1.10 if is_weekend else 1.0
    holiday_fx = 1.15 if is_holiday else 1.0
    season_fx = 0.7 + 0.6 * season_factor
    raw = 0.38 * price_fx * occ_fx * lead_fx * weekend_fx * holiday_fx * season_fx
    return min(max(raw + random.gauss(0, 0.04), 0.01), 0.97)


def _generate_rows(rt: RoomTypeConfig, hotel_id: int, type_id: int, segment: str, n_rows: int) -> list[dict[str, Any]]:
    rng = random.Random(RANDOM_SEED + type_id)
    rows: list[dict[str, Any]] = []
    start = date(2024, 1, 1)
    end = date(2025, 6, 30)
    span = (end - start).days

    while len(rows) < n_rows:
        snap_date = start + timedelta(days=rng.randint(0, span))
        lead = rng.choice([1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90])
        stay_date = snap_date + timedelta(days=lead)

        dow = stay_date.weekday()
        is_weekend = int(dow >= 5)
        is_holiday = int(stay_date in HOLIDAYS)
        month = stay_date.month
        sfactor = SEASON_DEMAND[month]

        max_occ = min(0.95, sfactor * (1.05 if is_holiday else 1.0))
        booked = int(round(rt.count * rng.uniform(max_occ * 0.4, max_occ)))
        booked = max(0, min(booked, rt.count))
        available = rt.count - booked
        occ_rate = round(booked / max(rt.count, 1), 4)

        noise = rng.uniform(-0.08, 0.12)
        offered = round(
            rt.base_price
            * (1 + noise + (0.07 if is_weekend else 0) + (0.10 if is_holiday else 0) + (sfactor - 0.7) * 0.3),
            2,
        )

        refundable = rng.choices([0, 1], weights=[0.4, 0.6])[0]
        breakfast = rng.choices([0, 1], weights=[0.55, 0.45])[0]
        prob = _booking_probability(offered, rt.base_price, occ_rate, lead, is_weekend, is_holiday, sfactor, refundable)
        booking_made = int(rng.random() < prob)

        rows.append(
            {
                "hotel_id": hotel_id,
                "hotel_segment": segment,
                "room_type_id": type_id,
                "room_type_name": rt.name,
                "snapshot_date": snap_date.isoformat(),
                "stay_date": stay_date.isoformat(),
                "lead_time": lead,
                "day_of_week": DAYS[dow],
                "week_of_year": stay_date.isocalendar()[1],
                "month": month,
                "year": stay_date.year,
                "season": SEASONS[month],
                "is_weekend": is_weekend,
                "is_holiday": is_holiday,
                "total_inventory": rt.count,
                "booked_rooms": booked,
                "available_rooms": available,
                "occupancy_rate": occ_rate,
                "base_price": rt.base_price,
                "offered_price": offered,
                "final_price": offered,
                "booking_made": booking_made,
                "rooms_booked": booking_made,
                "cancellation": int(booking_made and rng.random() < 0.12),
                "max_occupancy": rt.capacity,
                "refundable_rate_flag": refundable,
                "breakfast_included_flag": breakfast,
                "competitor_price": round(offered * rng.uniform(0.88, 1.14), 2),
                "event_score": round(rng.uniform(0.0, 1.0), 3) if rng.random() < 0.3 else "",
                "search_volume": round(rng.uniform(200, 2000) * sfactor, 1),
                "sea_view_flag": "",
                "balcony_flag": "",
                "amenity_score": "",
                "location_demand_index": round(rng.uniform(0.5, 1.5) * sfactor, 4),
                "feature_schema_version": "feature_schema_v1",
                "source_batch_id": f"generated_{hotel_id}_{rt.name.lower()}_v1",
            }
        )

    rows.sort(key=lambda r: (r["stay_date"], r["snapshot_date"]))
    return rows


@router.post("/inventory/setup", response_model=SetupResult)
def setup_inventory(
    config: InventoryConfig,
    db: Session = Depends(get_db),
    _auth: Any = Depends(_require_owner),
) -> SetupResult:
    # Count existing rooms before delete
    existing = db.execute(text("SELECT COUNT(*) FROM rooms")).scalar() or 0

    # Delete all existing rooms (CASCADE handles bookings, tasks, guest_tokens)
    db.execute(text("DELETE FROM rooms"))

    created = 0
    room_number = 1
    for rt in config.room_types:
        for _i in range(rt.count):
            num = f"{rt.name[:3].upper()}-{room_number:03d}"
            db.execute(
                text(
                    "INSERT INTO rooms (number, category, status, price, capacity, description) "
                    "VALUES (:num, :cat, 'Available', :price, :cap, :desc)"
                ),
                {
                    "num": num,
                    "cat": rt.name,
                    "price": rt.base_price,
                    "cap": rt.capacity,
                    "desc": f"{rt.name} room — {rt.capacity} guest(s)",
                },
            )
            room_number += 1
            created += 1

    db.commit()
    return SetupResult(
        rooms_deleted=int(existing),
        rooms_created=created,
        room_types=[rt.name for rt in config.room_types],
    )


@router.post("/inventory/generate-dataset")
def generate_dataset(
    config: InventoryConfig,
    _auth: Any = Depends(_require_owner),
) -> StreamingResponse:
    all_rows: list[dict[str, Any]] = []

    for rt in config.room_types:
        mapping = SEGMENT_MAP.get(rt.name, {"segment": "budget_city", "type_id": 99})
        rows = _generate_rows(
            rt=rt,
            hotel_id=config.hotel_id,
            type_id=mapping["type_id"],
            segment=mapping["segment"],
            n_rows=config.rows_per_type,
        )
        all_rows.extend(rows)

    all_rows.sort(key=lambda r: (r["stay_date"], r["snapshot_date"]))

    if not all_rows:
        raise HTTPException(status_code=400, detail="No rows generated.")

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(all_rows[0].keys()))
    writer.writeheader()
    writer.writerows(all_rows)
    output.seek(0)

    filename = f"hotel_{config.hotel_id}_training_dataset.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
