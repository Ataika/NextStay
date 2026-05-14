from datetime import datetime

from app.db.session import SessionLocal
from app.models.booking import Booking as BookingModel
from app.models.guest_token import GuestToken as GuestTokenModel
from app.models.room import Room as RoomModel
from app.models.task import CleaningTask as TaskModel
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter(tags=["guest"])


# Dependency to get the DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Pydantic models
class WiFiInfo(BaseModel):
    ssid: str
    password: str


class ContactInfo(BaseModel):
    phone: str | None = None
    whatsapp: str | None = None
    email: str | None = None


class Instructions(BaseModel):
    accessInfo: str
    activeFrom: str
    activeUntil: str
    doorTroubleshooting: str


class HouseRules(BaseModel):
    quietHours: str
    checkOutTime: str
    smokingPolicy: str


class GuestToken(BaseModel):
    token: str
    bookingId: int
    roomId: int
    roomNumber: str
    guestName: str
    checkIn: str
    checkOut: str
    isValid: bool
    accessStatus: str
    wifi: WiFiInfo
    contact: ContactInfo
    instructions: Instructions
    houseRules: HouseRules | None = None


# CRUD операции
@router.get("/guest/{token}", response_model=GuestToken)
def get_guest_by_token(token: str, db: Session = Depends(get_db)):
    """Get guest data by token"""
    guest_token = db.query(GuestTokenModel).filter(GuestTokenModel.token == token).first()

    if not guest_token:
        raise HTTPException(status_code=404, detail="Invalid or expired token")

    # Check token validity
    if not guest_token.is_valid:
        raise HTTPException(status_code=404, detail="Token is no longer valid")

    # Check expiration date
    from datetime import timezone

    now = datetime.now(timezone.utc) if guest_token.check_out.tzinfo else datetime.now()
    check_out_time = guest_token.check_out
    if check_out_time.tzinfo is None:
        # If no timezone, assume UTC
        check_out_time = check_out_time.replace(tzinfo=timezone.utc)

    if now > check_out_time:
        guest_token.access_status = "Expired"
        guest_token.is_valid = False
        db.commit()
        raise HTTPException(status_code=404, detail="Token has expired")

    # Form response
    return GuestToken(
        token=guest_token.token,
        bookingId=guest_token.booking_id,
        roomId=guest_token.room_id,
        roomNumber=guest_token.room_number,
        guestName=guest_token.guest_name,
        checkIn=guest_token.check_in.isoformat(),
        checkOut=guest_token.check_out.isoformat(),
        isValid=guest_token.is_valid,
        accessStatus=guest_token.access_status,
        wifi=WiFiInfo(ssid=guest_token.wifi_ssid, password=guest_token.wifi_password),
        contact=ContactInfo(**guest_token.contact_info) if guest_token.contact_info else ContactInfo(),
        instructions=Instructions(**guest_token.instructions)
        if guest_token.instructions
        else Instructions(accessInfo="", activeFrom="", activeUntil="", doorTroubleshooting=""),
        houseRules=HouseRules(**guest_token.house_rules) if guest_token.house_rules else None,
    )


@router.post("/guest/{token}/checkout")
def checkout_guest(token: str, db: Session = Depends(get_db)):
    """Process guest checkout: update booking, room and create cleaning task"""
    guest_token = db.query(GuestTokenModel).filter(GuestTokenModel.token == token).first()

    if not guest_token or not guest_token.is_valid:
        raise HTTPException(status_code=404, detail="Invalid or expired token")

    # Update token status
    guest_token.is_valid = False
    guest_token.access_status = "Checked out"

    # Update booking status
    booking = db.query(BookingModel).filter(BookingModel.id == guest_token.booking_id).first()
    if booking:
        booking.status = "Checked-out"

    # Update room status to "Dirty"
    room = db.query(RoomModel).filter(RoomModel.id == guest_token.room_id).first()
    if room:
        room.status = "Dirty"

        # Create cleaning task
        cleaning_task = TaskModel(
            room_id=room.id,
            room_number=room.number,
            status="Pending",
            priority="High",
            notes=f"Cleaning after checkout - Guest: {guest_token.guest_name}",
        )
        db.add(cleaning_task)

    db.commit()

    return {"message": "Checkout completed successfully", "roomNumber": guest_token.room_number}
