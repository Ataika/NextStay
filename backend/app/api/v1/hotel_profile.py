import re

from app.db.session import SessionLocal
from app.models.hotel_profile import HotelProfile as HotelProfileModel
from app.models.user import User as UserModel
from app.security.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

router = APIRouter(tags=["hotel"])

ADMIN_ROLES = {"OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"}
_TIME_RE = re.compile(r"^\d{2}:\d{2}$")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class HotelProfileOut(BaseModel):
    id: int
    hotel_name: str
    address: str | None
    lat: float | None
    lng: float | None
    currency: str | None
    phone: str | None
    check_in_time: str | None
    check_out_time: str | None
    wifi_name: str | None
    wifi_password: str | None
    house_rules: str | None

    class Config:
        from_attributes = True


class HotelProfileUpdate(BaseModel):
    hotel_name: str | None = Field(None, min_length=1, max_length=255)
    address: str | None = None
    lat: float | None = Field(None, ge=-90, le=90)
    lng: float | None = Field(None, ge=-180, le=180)
    currency: str | None = Field(None, min_length=3, max_length=3, description="ISO 4217 currency code")
    phone: str | None = Field(None, max_length=30)
    check_in_time: str | None = None
    check_out_time: str | None = None
    wifi_name: str | None = Field(None, max_length=100)
    wifi_password: str | None = Field(None, max_length=100)
    house_rules: str | None = None

    @field_validator("currency")
    @classmethod
    def currency_uppercase(cls, v: str | None) -> str | None:
        return v.upper() if v else v

    @field_validator("check_in_time", "check_out_time")
    @classmethod
    def validate_time_format(cls, v: str | None) -> str | None:
        if v is not None and not _TIME_RE.match(v):
            raise ValueError("Time must be in HH:MM format (e.g. '14:00')")
        return v


def _get_or_create_profile(db: Session) -> HotelProfileModel:
    profile = db.query(HotelProfileModel).first()
    if not profile:
        profile = HotelProfileModel(hotel_name="NextStay Hotel")
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("/hotel/profile", response_model=HotelProfileOut)
def get_hotel_profile(db: Session = Depends(get_db)):
    """Public endpoint — guest page reads this without auth."""
    return _get_or_create_profile(db)


@router.patch("/hotel/profile", response_model=HotelProfileOut)
def update_hotel_profile(
    payload: HotelProfileUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    if current_user.role.upper() not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions.")

    profile = _get_or_create_profile(db)

    update_fields = payload.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile
