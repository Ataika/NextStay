"""Multi-hotel tenancy helpers — scope data to the user's hotel."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.hotel_profile import HotelProfile as HotelProfileModel
from app.models.user import User as UserModel


def require_hotel_id(user: UserModel, db: Session) -> int:
    """Return the hotel id for an authenticated user; never fall back to another hotel."""
    if user.hotel_id:
        return user.hotel_id
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Account is not linked to a hotel. Contact support.",
    )


def get_hotel_profile_for_user(user: UserModel, db: Session) -> HotelProfileModel:
    hotel_id = require_hotel_id(user, db)
    profile = db.query(HotelProfileModel).filter(HotelProfileModel.id == hotel_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hotel not found.")
    return profile


def assert_user_in_hotel(target: UserModel, hotel_id: int) -> None:
    if target.hotel_id != hotel_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
