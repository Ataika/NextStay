"""Per-hotel pricing configuration endpoints.

Endpoints:
  GET /pricing/config/{hotel_id}   — read current config (returns defaults if none saved)
  PUT /pricing/config/{hotel_id}   — upsert config for a hotel
"""

import json
from typing import Any

from app.core.config import DEV_OWNER_TOKEN, DEV_OWNER_TOKEN_ENABLED
from app.security.auth import get_current_user, get_db, security
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

router = APIRouter(tags=["pricing-config"])

# Defaults applied when a hotel has no row in hotel_pricing_config.
_DEFAULTS: dict[str, float] = {
    "min_price": 30.0,
    "max_price": 1000.0,
    "max_daily_change_pct": 15.0,
    "weekend_multiplier": 1.2,
    "holiday_multiplier": 1.3,
    "rollout_fraction": 1.0,
}


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------


def _require_owner(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> Any:
    if DEV_OWNER_TOKEN_ENABLED and credentials is not None and credentials.credentials == DEV_OWNER_TOKEN:
        return {"role": "OWNER"}
    user = get_current_user(credentials=credentials, db=db)
    if user.role.upper() != "OWNER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions.")
    return user


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class HotelPricingConfig(BaseModel):
    hotelId: int
    minPrice: float
    maxPrice: float
    maxDailyChangePct: float
    weekendMultiplier: float
    holidayMultiplier: float
    rolloutFraction: float
    configVersion: str
    updatedAt: str | None = None
    activeModelVersion: str | None = None
    isDefault: bool = False


class UpdateHotelPricingConfig(BaseModel):
    minPrice: float = Field(..., ge=0, description="Absolute floor price (€)")
    maxPrice: float = Field(..., gt=0, description="Absolute ceiling price (€)")
    maxDailyChangePct: float = Field(..., ge=0, le=100, description="Max price change per day (%)")
    weekendMultiplier: float = Field(..., ge=1.0, le=3.0, description="Weekend price multiplier")
    holidayMultiplier: float = Field(..., ge=1.0, le=3.0, description="Holiday price multiplier")
    rolloutFraction: float = Field(..., ge=0.0, le=1.0, description="Fraction of requests using dynamic pricing")


# ---------------------------------------------------------------------------
# Serializer
# ---------------------------------------------------------------------------


def _build_response(
    hotel_id: int,
    db_row: dict | None,
    active_model: str | None,
) -> HotelPricingConfig:
    if db_row is None:
        return HotelPricingConfig(
            hotelId=hotel_id,
            minPrice=_DEFAULTS["min_price"],
            maxPrice=_DEFAULTS["max_price"],
            maxDailyChangePct=_DEFAULTS["max_daily_change_pct"],
            weekendMultiplier=_DEFAULTS["weekend_multiplier"],
            holidayMultiplier=_DEFAULTS["holiday_multiplier"],
            rolloutFraction=_DEFAULTS["rollout_fraction"],
            configVersion="default",
            updatedAt=None,
            activeModelVersion=active_model,
            isDefault=True,
        )

    cfg = db_row.get("config_json") or {}
    if isinstance(cfg, str):
        cfg = json.loads(cfg)

    updated_at = db_row.get("updated_at")
    return HotelPricingConfig(
        hotelId=hotel_id,
        minPrice=float(cfg.get("min_price", _DEFAULTS["min_price"])),
        maxPrice=float(cfg.get("max_price", _DEFAULTS["max_price"])),
        maxDailyChangePct=float(cfg.get("max_daily_change_pct", _DEFAULTS["max_daily_change_pct"])),
        weekendMultiplier=float(cfg.get("weekend_multiplier", _DEFAULTS["weekend_multiplier"])),
        holidayMultiplier=float(cfg.get("holiday_multiplier", _DEFAULTS["holiday_multiplier"])),
        rolloutFraction=float(cfg.get("rollout_fraction", _DEFAULTS["rollout_fraction"])),
        configVersion=str(db_row.get("config_version", "v1")),
        updatedAt=(
            updated_at.isoformat() if hasattr(updated_at, "isoformat") else str(updated_at) if updated_at else None
        ),
        activeModelVersion=active_model,
        isDefault=False,
    )


def _get_active_model(hotel_id: int, db: Session) -> str | None:
    return db.execute(
        text(
            "SELECT model_version FROM pricing.hotel_model_registry "
            "WHERE hotel_id = :hid AND is_active IS TRUE "
            "ORDER BY trained_at DESC LIMIT 1"
        ),
        {"hid": hotel_id},
    ).scalar()


def _assert_hotel_exists(hotel_id: int, db: Session) -> None:
    row = db.execute(
        text("SELECT hotel_id FROM core.dim_hotels WHERE hotel_id = :hid AND is_current IS TRUE"),
        {"hid": hotel_id},
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Hotel {hotel_id} not found.")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/pricing/config/{hotel_id}", response_model=HotelPricingConfig)
def get_hotel_config(
    hotel_id: int,
    db: Session = Depends(get_db),
    _auth: Any = Depends(_require_owner),
) -> HotelPricingConfig:
    _assert_hotel_exists(hotel_id, db)
    db_row = (
        db.execute(
            text("SELECT * FROM pricing.hotel_pricing_config WHERE hotel_id = :hid"),
            {"hid": hotel_id},
        )
        .mappings()
        .first()
    )
    active_model = _get_active_model(hotel_id, db)
    return _build_response(hotel_id, dict(db_row) if db_row else None, active_model)


@router.put("/pricing/config/{hotel_id}", response_model=HotelPricingConfig)
def update_hotel_config(
    hotel_id: int,
    body: UpdateHotelPricingConfig,
    db: Session = Depends(get_db),
    _auth: Any = Depends(_require_owner),
) -> HotelPricingConfig:
    _assert_hotel_exists(hotel_id, db)

    if body.minPrice >= body.maxPrice:
        raise HTTPException(status_code=422, detail="minPrice must be strictly less than maxPrice.")

    cfg = {
        "min_price": body.minPrice,
        "max_price": body.maxPrice,
        "max_daily_change_pct": body.maxDailyChangePct,
        "weekend_multiplier": body.weekendMultiplier,
        "holiday_multiplier": body.holidayMultiplier,
        "rollout_fraction": body.rolloutFraction,
    }

    db.execute(
        text(
            "INSERT INTO pricing.hotel_pricing_config "
            "    (hotel_id, config_json, config_version, updated_at) "
            "VALUES (:hid, :cfg::jsonb, 'v1', NOW()) "
            "ON CONFLICT (hotel_id) DO UPDATE "
            "SET config_json = EXCLUDED.config_json, updated_at = NOW()"
        ),
        {"hid": hotel_id, "cfg": json.dumps(cfg)},
    )
    db.commit()

    db_row = (
        db.execute(
            text("SELECT * FROM pricing.hotel_pricing_config WHERE hotel_id = :hid"),
            {"hid": hotel_id},
        )
        .mappings()
        .first()
    )
    active_model = _get_active_model(hotel_id, db)
    return _build_response(hotel_id, dict(db_row) if db_row else None, active_model)
