from datetime import date, datetime
from decimal import Decimal
from typing import Any

from app.core.config import DEV_OWNER_TOKEN, DEV_OWNER_TOKEN_ENABLED
from app.security.auth import get_current_user, get_db, security
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

router = APIRouter(tags=["pricing-lab"])


class HotelOption(BaseModel):
    hotelId: int
    hotelName: str
    hotelSegment: str


class PublishedPriceRow(BaseModel):
    hotelId: int
    hotelName: str
    hotelSegment: str
    roomTypeId: int
    roomTypeName: str
    stayDate: str
    snapshotDate: str
    basePrice: float | None = None
    dynamicPrice: float
    priceDeltaPct: float | None = None
    offeredPrice: float | None = None
    availableRooms: int | None = None
    bookedRooms: int | None = None
    totalInventory: int | None = None
    occupancyRate: float | None = None
    modelVersion: str | None = None
    rulesVersion: str | None = None
    inRollout: int | None = None
    inferenceStatus: str | None = None


class PublishedPricesResponse(BaseModel):
    hotelId: int | None = None
    stayDate: str | None = None
    availableHotels: list[HotelOption]
    rows: list[PublishedPriceRow]


class DecisionResponse(BaseModel):
    published: dict[str, Any]
    decision: dict[str, Any] | None = None
    context: dict[str, Any] | None = None
    ruleMetadata: dict[str, Any]


def _serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def _serialize_record(record: dict[str, Any] | None) -> dict[str, Any] | None:
    if record is None:
        return None
    return {key: _serialize_value(value) for key, value in record.items()}


def _row_to_published_response(row: dict[str, Any]) -> PublishedPriceRow:
    serialized = _serialize_record(row) or {}
    return PublishedPriceRow(
        hotelId=int(serialized["hotel_id"]),
        hotelName=str(serialized["hotel_name"]),
        hotelSegment=str(serialized["hotel_segment"]),
        roomTypeId=int(serialized["room_type_id"]),
        roomTypeName=str(serialized["room_type_name"]),
        stayDate=str(serialized["stay_date"]),
        snapshotDate=str(serialized["snapshot_date"]),
        basePrice=serialized.get("base_price"),
        dynamicPrice=float(serialized["dynamic_price"]),
        priceDeltaPct=serialized.get("price_delta_pct"),
        offeredPrice=serialized.get("offered_price"),
        availableRooms=serialized.get("available_rooms"),
        bookedRooms=serialized.get("booked_rooms"),
        totalInventory=serialized.get("total_inventory"),
        occupancyRate=serialized.get("occupancy_rate"),
        modelVersion=serialized.get("model_version"),
        rulesVersion=serialized.get("rules_version"),
        inRollout=serialized.get("in_rollout"),
        inferenceStatus=serialized.get("inference_status"),
    )


def require_pricing_lab_owner(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
):
    if DEV_OWNER_TOKEN_ENABLED and credentials is not None and credentials.credentials == DEV_OWNER_TOKEN:
        return {"role": "OWNER", "authSource": "dev_token"}

    user = get_current_user(credentials=credentials, db=db)
    if user.role.upper() != "OWNER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions.")
    return user


@router.get("/pricing-lab/published", response_model=PublishedPricesResponse)
def get_published_prices(
    hotel_id: int | None = Query(default=None),
    stay_date: date | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    _auth=Depends(require_pricing_lab_owner),
):
    available_hotels_rows = db.execute(
        text(
            """
            SELECT DISTINCT
                hotel_id,
                hotel_name,
                hotel_segment
            FROM core.dim_hotels
            WHERE is_current IS TRUE
            ORDER BY hotel_id
            """
        )
    ).mappings()
    available_hotels = [
        HotelOption(
            hotelId=int(row["hotel_id"]),
            hotelName=str(row["hotel_name"]),
            hotelSegment=str(row["hotel_segment"]),
        )
        for row in available_hotels_rows
    ]

    rows = db.execute(
        text(
            """
            WITH latest_published AS (
                SELECT DISTINCT ON (p.hotel_id, p.room_type_id, p.stay_date)
                    p.hotel_id,
                    p.room_type_id,
                    p.stay_date,
                    p.snapshot_date,
                    p.final_price,
                    p.updated_at,
                    p.in_rollout,
                    p.inference_status,
                    p.model_version,
                    p.rules_version
                FROM pricing.published_prices p
                WHERE (:hotel_id IS NULL OR p.hotel_id = :hotel_id)
                  AND (:stay_date IS NULL OR p.stay_date = :stay_date)
                ORDER BY
                    p.hotel_id,
                    p.room_type_id,
                    p.stay_date,
                    p.snapshot_date DESC,
                    p.updated_at DESC
            )
            SELECT
                lp.hotel_id,
                COALESCE(h.hotel_name, 'Hotel ' || lp.hotel_id::text) AS hotel_name,
                COALESCE(h.hotel_segment, ctx.hotel_segment, 'unknown') AS hotel_segment,
                lp.room_type_id,
                COALESCE(
                    rt.room_type_name,
                    ctx.room_type_name,
                    'Room Type ' || lp.room_type_id::text
                ) AS room_type_name,
                lp.stay_date,
                lp.snapshot_date,
                ctx.base_price,
                lp.final_price AS dynamic_price,
                CASE
                    WHEN ctx.base_price IS NULL OR ctx.base_price = 0 THEN NULL
                    ELSE ROUND(((lp.final_price - ctx.base_price) / ctx.base_price) * 100, 2)
                END AS price_delta_pct,
                ctx.offered_price,
                ctx.available_rooms,
                ctx.booked_rooms,
                ctx.total_inventory,
                ctx.occupancy_rate,
                COALESCE(dec.model_version, lp.model_version) AS model_version,
                COALESCE(dec.rules_version, lp.rules_version) AS rules_version,
                lp.in_rollout,
                lp.inference_status
            FROM latest_published lp
            LEFT JOIN core.dim_hotels h
                ON h.hotel_id = lp.hotel_id
               AND h.is_current IS TRUE
            LEFT JOIN core.dim_room_types rt
                ON rt.room_type_id = lp.room_type_id
               AND rt.is_current IS TRUE
               AND (h.hotel_sk IS NULL OR rt.hotel_sk = h.hotel_sk)
            LEFT JOIN LATERAL (
                SELECT *
                FROM pricing.inventory_snapshots i
                WHERE i.hotel_id = lp.hotel_id
                  AND i.room_type_id = lp.room_type_id
                  AND i.stay_date = lp.stay_date
                  AND i.snapshot_date = lp.snapshot_date
                ORDER BY i.created_at DESC
                LIMIT 1
            ) ctx ON TRUE
            LEFT JOIN LATERAL (
                SELECT *
                FROM pricing.price_decisions d
                WHERE d.hotel_id = lp.hotel_id
                  AND d.room_type_id = lp.room_type_id
                  AND d.stay_date = lp.stay_date
                  AND d.snapshot_date = lp.snapshot_date
                ORDER BY d.created_at DESC
                LIMIT 1
            ) dec ON TRUE
            ORDER BY lp.stay_date, lp.room_type_id
            LIMIT :limit
            """
        ),
        {"hotel_id": hotel_id, "stay_date": stay_date, "limit": limit},
    ).mappings()

    return PublishedPricesResponse(
        hotelId=hotel_id,
        stayDate=stay_date.isoformat() if stay_date else None,
        availableHotels=available_hotels,
        rows=[_row_to_published_response(dict(row)) for row in rows],
    )


@router.get("/pricing-lab/decision", response_model=DecisionResponse)
def get_pricing_decision(
    hotel_id: int = Query(...),
    room_type_id: int = Query(...),
    stay_date: date = Query(...),
    snapshot_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    _auth=Depends(require_pricing_lab_owner),
):
    selected_snapshot_date = snapshot_date
    if selected_snapshot_date is None:
        selected_snapshot_date = db.execute(
            text(
                """
                SELECT p.snapshot_date
                FROM pricing.published_prices p
                WHERE p.hotel_id = :hotel_id
                  AND p.room_type_id = :room_type_id
                  AND p.stay_date = :stay_date
                ORDER BY p.snapshot_date DESC, p.updated_at DESC
                LIMIT 1
                """
            ),
            {"hotel_id": hotel_id, "room_type_id": room_type_id, "stay_date": stay_date},
        ).scalar()

    if selected_snapshot_date is None:
        raise HTTPException(status_code=404, detail="No pricing decision found for the requested keys.")

    published_row = (
        db.execute(
            text(
                """
            SELECT *
            FROM pricing.published_prices
            WHERE hotel_id = :hotel_id
              AND room_type_id = :room_type_id
              AND stay_date = :stay_date
              AND snapshot_date = :snapshot_date
            ORDER BY updated_at DESC
            LIMIT 1
            """
            ),
            {
                "hotel_id": hotel_id,
                "room_type_id": room_type_id,
                "stay_date": stay_date,
                "snapshot_date": selected_snapshot_date,
            },
        )
        .mappings()
        .first()
    )

    if published_row is None:
        raise HTTPException(status_code=404, detail="Published pricing row not found.")

    decision_row = (
        db.execute(
            text(
                """
            SELECT *
            FROM pricing.price_decisions
            WHERE hotel_id = :hotel_id
              AND room_type_id = :room_type_id
              AND stay_date = :stay_date
              AND snapshot_date = :snapshot_date
            ORDER BY created_at DESC
            LIMIT 1
            """
            ),
            {
                "hotel_id": hotel_id,
                "room_type_id": room_type_id,
                "stay_date": stay_date,
                "snapshot_date": selected_snapshot_date,
            },
        )
        .mappings()
        .first()
    )

    context_row = (
        db.execute(
            text(
                """
            SELECT *
            FROM pricing.inventory_snapshots
            WHERE hotel_id = :hotel_id
              AND room_type_id = :room_type_id
              AND stay_date = :stay_date
              AND snapshot_date = :snapshot_date
            ORDER BY created_at DESC
            LIMIT 1
            """
            ),
            {
                "hotel_id": hotel_id,
                "room_type_id": room_type_id,
                "stay_date": stay_date,
                "snapshot_date": selected_snapshot_date,
            },
        )
        .mappings()
        .first()
    )

    serialized_published = _serialize_record(dict(published_row)) or {}
    serialized_decision = _serialize_record(dict(decision_row)) if decision_row is not None else None
    serialized_context = _serialize_record(dict(context_row)) if context_row is not None else None

    return DecisionResponse(
        published=serialized_published,
        decision=serialized_decision,
        context=serialized_context,
        ruleMetadata={
            "modelVersion": (
                serialized_decision.get("model_version")
                if serialized_decision
                else serialized_published.get("model_version")
            ),
            "rulesVersion": (
                serialized_decision.get("rules_version")
                if serialized_decision
                else serialized_published.get("rules_version")
            ),
            "ruleAdjustments": serialized_decision.get("rule_adjustments") if serialized_decision else None,
            "fallbackReason": serialized_decision.get("fallback_reason") if serialized_decision else None,
            "inRollout": (
                serialized_decision.get("in_rollout") if serialized_decision else serialized_published.get("in_rollout")
            ),
            "inferenceStatus": (
                serialized_decision.get("inference_status")
                if serialized_decision
                else serialized_published.get("inference_status")
            ),
        },
    )
