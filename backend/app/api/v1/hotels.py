from datetime import datetime

from app.db.session import SessionLocal
from app.models.hotel_profile import HotelProfile as HotelProfileModel
from app.services.room_availability import get_available_rooms_for_stay, parse_booking_dates
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter(tags=["hotels"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class AvailableHotelResponse(BaseModel):
    id: int
    hotelName: str
    city: str | None = None
    address: str | None = None
    minPricePerNight: float
    availableRoomCount: int


class AvailableHotelsResponse(BaseModel):
    hotels: list[AvailableHotelResponse]
    checkIn: str
    checkOut: str


@router.get("/hotels/available", response_model=AvailableHotelsResponse)
def get_available_hotels(
    checkIn: str,
    checkOut: str,
    db: Session = Depends(get_db),
):
    try:
        check_in_date, check_out_date, _ = parse_booking_dates(checkIn, checkOut)
    except (ValueError, AttributeError) as err:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use ISO format (e.g., 2026-02-01T14:00:00Z)",
        ) from err

    now = datetime.now(check_in_date.tzinfo) if check_in_date.tzinfo else datetime.now()
    if check_in_date < now.replace(hour=0, minute=0, second=0, microsecond=0):
        raise HTTPException(status_code=400, detail="Check-in date cannot be in the past")

    if check_out_date <= check_in_date:
        raise HTTPException(status_code=400, detail="Check-out date must be after check-in date")

    hotels: list[AvailableHotelResponse] = []
    profiles = db.query(HotelProfileModel).order_by(HotelProfileModel.hotel_name).all()

    for profile in profiles:
        available_rooms, _ = get_available_rooms_for_stay(
            db,
            check_in_date,
            check_out_date,
            hotel_id=profile.id,
        )
        if not available_rooms:
            continue

        min_price = min(room.price for room in available_rooms)
        hotels.append(
            AvailableHotelResponse(
                id=profile.id,
                hotelName=profile.hotel_name,
                city=profile.city,
                address=profile.address,
                minPricePerNight=round(min_price, 2),
                availableRoomCount=len(available_rooms),
            )
        )

    hotels.sort(key=lambda item: (item.city or "", item.minPricePerNight, item.hotelName))

    return AvailableHotelsResponse(hotels=hotels, checkIn=checkIn, checkOut=checkOut)
