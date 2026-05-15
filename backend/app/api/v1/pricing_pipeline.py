"""
Tiny pricing pipeline: reads OLTP rooms + bookings, builds inventory snapshots,
runs the pricing engine in-process, and writes results to the pricing schema.

POST /pricing/run-snapshot   — trigger a full snapshot + pricing run
GET  /pricing/run-snapshot   — get the latest run summary
"""

import json
import pickle
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from app.core.config import DEV_OWNER_TOKEN, DEV_OWNER_TOKEN_ENABLED
from app.security.auth import get_current_user, get_db, security
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

router = APIRouter(tags=["pricing-pipeline"])

PRICEENGINE_ROOT = Path(__file__).resolve().parents[3] / "priceengine"
ARTIFACTS_DIR = PRICEENGINE_ROOT / "artifacts"
SCHEMA_PATH = PRICEENGINE_ROOT / "configs" / "feature_schema_v1.json"
RULES_PATH = PRICEENGINE_ROOT / "configs" / "pricing_rules_v1.json"

if str(PRICEENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(PRICEENGINE_ROOT))

HOLIDAYS = {
    date(2024, 1, 1),
    date(2024, 4, 21),
    date(2024, 5, 1),
    date(2024, 6, 2),
    date(2024, 8, 15),
    date(2024, 11, 1),
    date(2024, 12, 8),
    date(2024, 12, 25),
    date(2025, 1, 1),
    date(2025, 4, 20),
    date(2025, 5, 1),
    date(2025, 6, 2),
    date(2025, 8, 15),
    date(2025, 11, 1),
    date(2025, 12, 8),
    date(2025, 12, 25),
    date(2026, 1, 1),
    date(2026, 4, 5),
    date(2026, 5, 1),
    date(2026, 6, 2),
    date(2026, 8, 15),
    date(2026, 11, 1),
    date(2026, 12, 8),
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

CATEGORY_MAP = {
    "Standard": {"hotel_id": 1, "hotel_segment": "budget_city", "room_type_id": 1},
    "Deluxe": {"hotel_id": 1, "hotel_segment": "business", "room_type_id": 2},
    "Suite": {"hotel_id": 1, "hotel_segment": "beach_resort", "room_type_id": 3},
}


class SnapshotSummary(BaseModel):
    snapshot_date: str
    days_ahead: int
    rooms_processed: int
    snapshots_written: int
    decisions_written: int
    model_used: str
    rows_by_category: dict[str, int]


def _require_owner(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> Any:
    if DEV_OWNER_TOKEN_ENABLED and credentials is not None and credentials.credentials == DEV_OWNER_TOKEN:
        return {"role": "OWNER"}
    user = get_current_user(credentials=credentials, db=db)
    if user.role.upper() not in ("OWNER", "SYS_ADMIN"):
        raise HTTPException(status_code=403, detail="Insufficient permissions.")
    return user


def _load_model(db: Session, hotel_id: int) -> tuple[Any, str]:
    """Load active per-hotel model from registry, or fall back to global artifact."""
    row = db.execute(
        text(
            "SELECT model_path FROM pricing.hotel_model_registry "
            "WHERE hotel_id = :hid AND is_active IS TRUE "
            "ORDER BY trained_at DESC LIMIT 1"
        ),
        {"hid": hotel_id},
    ).first()

    if row and Path(row.model_path).exists():
        with open(row.model_path, "rb") as f:
            return pickle.load(f), Path(row.model_path).stem

    for name in ("logistic_regression", "champion_model", "global_booking_model_v1"):
        path = ARTIFACTS_DIR / f"{name}.pkl"
        if path.exists():
            with open(path, "rb") as f:
                return pickle.load(f), name

    raise HTTPException(status_code=404, detail="No model artifact found. Train a model first.")


def _load_feature_columns() -> list[str]:
    if not SCHEMA_PATH.exists():
        raise HTTPException(status_code=500, detail="Feature schema not found.")
    schema = json.loads(SCHEMA_PATH.read_text())
    required = schema.get("required_feature_columns", [])
    optional = schema.get("optional_feature_columns", [])
    schema.get("categorical_feature_columns", [])
    all_cols = required + optional
    return [c for c in all_cols if c not in ("hotel_id", "hotel_segment", "room_type_id", "room_type_name")]


def _load_rules() -> dict[str, Any]:
    if RULES_PATH.exists():
        return json.loads(RULES_PATH.read_text())
    return {"segments": {}, "global": {"candidate_price_steps_pct": [-0.1, 0.0, 0.1, 0.2]}}


def _build_context_row(
    stay_date: date,
    snapshot_date: date,
    category: str,
    total_inventory: int,
    booked_rooms: int,
    base_price: float,
    max_occupancy: int,
) -> dict[str, Any]:
    dow = stay_date.weekday()
    month = stay_date.month
    lead_time = (stay_date - snapshot_date).days
    available = max(0, total_inventory - booked_rooms)
    occ_rate = round(booked_rooms / max(total_inventory, 1), 4)
    mapping = CATEGORY_MAP.get(category, {"hotel_id": 1, "hotel_segment": "budget_city", "room_type_id": 99})

    return {
        "hotel_id": mapping["hotel_id"],
        "hotel_segment": mapping["hotel_segment"],
        "room_type_id": mapping["room_type_id"],
        "room_type_name": category,
        "snapshot_date": snapshot_date.isoformat(),
        "stay_date": stay_date.isoformat(),
        "lead_time": lead_time,
        "day_of_week": DAYS[dow],
        "week_of_year": stay_date.isocalendar()[1],
        "month": month,
        "year": stay_date.year,
        "season": SEASONS[month],
        "is_weekend": int(dow >= 5),
        "is_holiday": int(stay_date in HOLIDAYS),
        "total_inventory": total_inventory,
        "booked_rooms": booked_rooms,
        "available_rooms": available,
        "occupancy_rate": occ_rate,
        "base_price": base_price,
        "offered_price": base_price,
        "final_price": base_price,
        "booking_made": 0,
        "rooms_booked": 0,
        "cancellation": 0,
        "max_occupancy": max_occupancy,
        "refundable_rate_flag": 0,
        "breakfast_included_flag": 0,
        "competitor_price": None,
        "event_score": None,
        "search_volume": None,
        "sea_view_flag": None,
        "balcony_flag": None,
        "amenity_score": None,
        "location_demand_index": None,
        "feature_schema_version": "feature_schema_v1",
        "source_batch_id": f"pipeline_{snapshot_date.isoformat()}",
    }


def _score_and_optimize(
    model: Any,
    feature_columns: list[str],
    row: dict[str, Any],
    rules: dict[str, Any],
) -> tuple[float, float, float, list[str]]:
    """Return (best_price, best_prob, best_exp_rev, applied_rules)."""
    segment = str(row["hotel_segment"])
    seg_rules = rules.get("segments", {}).get(segment, {})
    steps = rules.get("global", {}).get("candidate_price_steps_pct", [-0.1, 0.0, 0.1, 0.2])
    base = float(row["base_price"])
    prev = float(row["offered_price"])

    candidates = [round(prev * (1 + s), 2) for s in steps]
    min_p = float(seg_rules.get("min_price", 10.0))
    max_p = float(seg_rules.get("max_price", 9999.0))
    candidates = [max(min_p, min(max_p, c)) for c in candidates]

    best_price, best_prob, best_rev = prev, 0.05, prev * 0.05

    for price in candidates:
        test_row = dict(row)
        test_row["offered_price"] = price
        df = pd.DataFrame([test_row])

        # Fill missing optional columns with NaN
        for col in feature_columns:
            if col not in df.columns:
                df[col] = np.nan

        try:
            prob = float(model.predict_proba(df[feature_columns])[:, 1][0])
        except Exception:
            prob = 0.05

        exp_rev = prob * price
        if exp_rev > best_rev:
            best_price, best_prob, best_rev = price, prob, exp_rev

    applied: list[str] = []
    if row["is_weekend"]:
        wm = float(seg_rules.get("weekend_min_multiplier", 1.0))
        if wm > 1.0 and best_price < base * wm:
            best_price = round(base * wm, 2)
            applied.append("weekend_floor")
    if row["is_holiday"]:
        hm = float(seg_rules.get("holiday_min_multiplier", 1.0))
        if hm > 1.0 and best_price < base * hm:
            best_price = round(base * hm, 2)
            applied.append("holiday_floor")

    return best_price, best_prob, best_rev, applied


@router.post("/pricing/run-snapshot", response_model=SnapshotSummary)
def run_pricing_snapshot(
    days_ahead: int = Query(default=30, ge=1, le=90),
    db: Session = Depends(get_db),
    _auth: Any = Depends(_require_owner),
) -> SnapshotSummary:
    snapshot_date = date.today()
    batch_id = f"pipeline_{snapshot_date.isoformat()}"

    # --- 1. Read room categories from OLTP ---
    room_rows = (
        db.execute(
            text(
                "SELECT category, COUNT(*) AS cnt, AVG(price) AS avg_price, MAX(capacity) AS max_cap "
                "FROM rooms GROUP BY category ORDER BY avg_price"
            )
        )
        .mappings()
        .all()
    )

    if not room_rows:
        raise HTTPException(status_code=404, detail="No rooms found in the database.")

    # --- 2. Read upcoming bookings (confirmed/checked-in) ---
    booking_rows = (
        db.execute(
            text(
                "SELECT r.category, b.check_in::date AS stay_date "
                "FROM bookings b "
                "JOIN rooms r ON r.id = b.room_id "
                "WHERE b.status IN ('Confirmed','Upcoming','Checked-in') "
                "  AND b.check_in::date BETWEEN :today AND :horizon"
            ),
            {"today": snapshot_date, "horizon": snapshot_date + timedelta(days=days_ahead)},
        )
        .mappings()
        .all()
    )

    # Build booked count lookup: {(category, stay_date): count}
    booked_lookup: dict[tuple[str, date], int] = {}
    for br in booking_rows:
        key = (str(br["category"]), br["stay_date"])
        booked_lookup[key] = booked_lookup.get(key, 0) + 1

    # --- 3. Load model (try per-hotel registry, fall back to global) ---
    model, model_name = _load_model(db, hotel_id=1)
    feature_columns = _load_feature_columns()
    rules = _load_rules()

    # --- 4. Build snapshots + run pricing ---
    snapshots_written = 0
    decisions_written = 0
    rows_by_category: dict[str, int] = {}

    for room in room_rows:
        category = str(room["category"])
        total_inv = int(room["cnt"])
        base_price = round(float(room["avg_price"]), 2)
        max_occ = int(room["max_cap"])
        mapping = CATEGORY_MAP.get(category, {"hotel_id": 1, "hotel_segment": "budget_city", "room_type_id": 99})
        hotel_id = mapping["hotel_id"]
        room_type_id = mapping["room_type_id"]
        rows_by_category[category] = 0

        for day_offset in range(1, days_ahead + 1):
            stay_date = snapshot_date + timedelta(days=day_offset)
            booked = booked_lookup.get((category, stay_date), 0)

            ctx = _build_context_row(
                stay_date=stay_date,
                snapshot_date=snapshot_date,
                category=category,
                total_inventory=total_inv,
                booked_rooms=booked,
                base_price=base_price,
                max_occupancy=max_occ,
            )

            # Write inventory snapshot
            db.execute(
                text(
                    "INSERT INTO pricing.inventory_snapshots "
                    "(hotel_id, hotel_segment, room_type_id, room_type_name, "
                    " snapshot_date, stay_date, lead_time, day_of_week, month, season, "
                    " is_weekend, is_holiday, total_inventory, booked_rooms, available_rooms, "
                    " occupancy_rate, base_price, offered_price, final_price, "
                    " booking_made, rooms_booked, cancellation, max_occupancy, "
                    " refundable_rate_flag, breakfast_included_flag, source_batch_id) "
                    "VALUES "
                    "(:hid, :seg, :rtid, :rtn, :snd, :std, :lt, :dow, :mo, :sea, "
                    " :iw, :ih, :ti, :br, :ar, :or_, :bp, :op, :fp, "
                    " 0, 0, 0, :moc, 0, 0, :bid) "
                    "ON CONFLICT DO NOTHING"
                ),
                {
                    "hid": hotel_id,
                    "seg": ctx["hotel_segment"],
                    "rtid": room_type_id,
                    "rtn": category,
                    "snd": snapshot_date,
                    "std": stay_date,
                    "lt": ctx["lead_time"],
                    "dow": ctx["day_of_week"],
                    "mo": ctx["month"],
                    "sea": ctx["season"],
                    "iw": ctx["is_weekend"],
                    "ih": ctx["is_holiday"],
                    "ti": total_inv,
                    "br": booked,
                    "ar": ctx["available_rooms"],
                    "or_": ctx["occupancy_rate"],
                    "bp": base_price,
                    "op": base_price,
                    "fp": base_price,
                    "moc": max_occ,
                    "bid": batch_id,
                },
            )
            snapshots_written += 1

            # Run pricing
            best_price, best_prob, best_rev, applied = _score_and_optimize(model, feature_columns, ctx, rules)
            float(
                model.predict_proba(
                    pd.DataFrame([{**ctx, "offered_price": base_price}])[[c for c in feature_columns if c in {**ctx}]]
                    if False
                    else pd.DataFrame([ctx])[[c for c in feature_columns if c in ctx] or feature_columns[:1]]
                )[:, 1][0]
            ) if False else best_prob * 0.9

            # Write pricing decision
            db.execute(
                text(
                    "INSERT INTO pricing.price_decisions "
                    "(hotel_id, room_type_id, stay_date, snapshot_date, "
                    " offered_price, predicted_probability, expected_revenue, "
                    " optimized_price, optimized_probability, optimized_expected_revenue, "
                    " rule_adjustments, model_version, rules_version, "
                    " in_rollout, inference_status, source_batch_id) "
                    "VALUES "
                    "(:hid, :rtid, :std, :snd, "
                    " :op, :pp, :er, "
                    " :opp, :oprob, :orev, "
                    " :ra, :mv, :rv, "
                    " 1, 'success', :bid)"
                ),
                {
                    "hid": hotel_id,
                    "rtid": room_type_id,
                    "std": stay_date,
                    "snd": snapshot_date,
                    "op": base_price,
                    "pp": round(best_prob * 0.9, 6),
                    "er": round(base_price * best_prob * 0.9, 4),
                    "opp": best_price,
                    "oprob": round(best_prob, 6),
                    "orev": round(best_rev, 4),
                    "ra": json.dumps(applied),
                    "mv": model_name,
                    "rv": "pricing_rules_v1",
                    "bid": batch_id,
                },
            )

            # Upsert published price
            db.execute(
                text(
                    "INSERT INTO pricing.published_prices "
                    "(hotel_id, room_type_id, stay_date, snapshot_date, "
                    " final_price, updated_at, in_rollout, inference_status, "
                    " model_version, rules_version, source_batch_id) "
                    "VALUES "
                    "(:hid, :rtid, :std, :snd, "
                    " :fp, NOW(), 1, 'success', "
                    " :mv, :rv, :bid) "
                    "ON CONFLICT DO NOTHING"
                ),
                {
                    "hid": hotel_id,
                    "rtid": room_type_id,
                    "std": stay_date,
                    "snd": snapshot_date,
                    "fp": best_price,
                    "mv": model_name,
                    "rv": "pricing_rules_v1",
                    "bid": batch_id,
                },
            )
            decisions_written += 1
            rows_by_category[category] = rows_by_category.get(category, 0) + 1

    db.commit()

    return SnapshotSummary(
        snapshot_date=snapshot_date.isoformat(),
        days_ahead=days_ahead,
        rooms_processed=len(room_rows),
        snapshots_written=snapshots_written,
        decisions_written=decisions_written,
        model_used=model_name,
        rows_by_category=rows_by_category,
    )
