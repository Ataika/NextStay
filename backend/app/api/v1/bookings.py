import json
import secrets
from datetime import datetime, timezone
from typing import Annotated

from app.core.task_utils import round_robin_assign
from app.db.session import SessionLocal
from app.models.booking import Booking as BookingModel
from app.models.guest_token import GuestToken as GuestTokenModel
from app.models.hotel_profile import HotelProfile as HotelProfileModel
from app.models.room import Room as RoomModel
from app.models.task import CleaningTask as TaskModel
from app.models.user import User as UserModel
from app.security.auth import require_roles
from app.security.tenancy import require_hotel_id
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import and_, or_, text
from sqlalchemy.orm import Session

router = APIRouter(tags=["bookings"])

# Valid booking status transitions (state machine)
VALID_STATUS_TRANSITIONS: dict[str, set[str]] = {
    "Pending": {"Confirmed", "Upcoming", "Cancelled"},
    "Confirmed": {"Upcoming", "Cancelled"},
    "Upcoming": {"Checked-in", "Cancelled"},
    "Checked-in": {"Checked-out"},
    "Checked-out": set(),
    "Cancelled": set(),
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class BookingBase(BaseModel):
    guestName: str
    roomId: int
    roomNumber: str
    checkIn: str
    checkOut: str
    status: str
    notes: str | None = None
    email: EmailStr | None = None


class BookingCreate(BaseModel):
    guestName: str
    roomId: int
    roomNumber: str
    checkIn: str
    checkOut: str
    status: str = "Pending"
    notes: str | None = None
    email: EmailStr | None = None
    holdId: int | None = None
    sessionId: str | None = None


class BookingUpdate(BaseModel):
    guestName: str | None = None
    roomId: int | None = None
    roomNumber: str | None = None
    checkIn: str | None = None
    checkOut: str | None = None
    status: str | None = None
    notes: str | None = None


class Booking(BookingBase):
    id: int
    createdAt: str
    guestToken: str | None = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_dates(
        cls,
        obj: BookingModel,
        include_token: bool = False,
        db: Session | None = None,
    ):
        token = None
        if include_token and db:
            guest_token = db.query(GuestTokenModel).filter(GuestTokenModel.booking_id == obj.id).first()
            if guest_token:
                token = guest_token.token

        return cls(
            id=obj.id,
            guestName=obj.guest_name,
            roomId=obj.room_id,
            roomNumber=obj.room_number,
            checkIn=obj.check_in.isoformat() if obj.check_in else "",
            checkOut=obj.check_out.isoformat() if obj.check_out else "",
            status=obj.status,
            notes=obj.notes,
            createdAt=obj.created_at.isoformat() if obj.created_at else datetime.now().isoformat(),
            guestToken=token,
        )


@router.get("/bookings", response_model=list[Booking])
def get_all_bookings(
    db: Annotated[Session, Depends(get_db)],
    current_user: UserModel = Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    hotel_id = require_hotel_id(current_user, db)
    bookings = (
        db.query(BookingModel)
        .join(RoomModel, BookingModel.room_id == RoomModel.id)
        .filter(RoomModel.hotel_id == hotel_id)
        .all()
    )
    return [Booking.from_orm_with_dates(booking, include_token=True, db=db) for booking in bookings]


@router.get("/bookings/{booking_id}", response_model=Booking)
def get_booking_by_id(
    booking_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: UserModel = Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    hotel_id = require_hotel_id(current_user, db)
    booking = (
        db.query(BookingModel)
        .join(RoomModel, BookingModel.room_id == RoomModel.id)
        .filter(BookingModel.id == booking_id, RoomModel.hotel_id == hotel_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return Booking.from_orm_with_dates(booking, include_token=True, db=db)


@router.post("/bookings", response_model=Booking, status_code=201)
def create_booking(booking: BookingCreate, db: Annotated[Session, Depends(get_db)]):
    """Create a new booking with a guest token, using a row lock to prevent double-booking."""
    try:
        check_in = datetime.fromisoformat(booking.checkIn.replace("Z", "+00:00"))
        check_out = datetime.fromisoformat(booking.checkOut.replace("Z", "+00:00"))
    except (ValueError, AttributeError) as err:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use ISO format (e.g., 2026-01-20T14:00:00Z)",
        ) from err

    now = datetime.now(check_in.tzinfo) if check_in.tzinfo else datetime.now()
    if check_in < now.replace(hour=0, minute=0, second=0, microsecond=0):
        raise HTTPException(status_code=400, detail="Check-in date cannot be in the past")

    if check_out <= check_in:
        raise HTTPException(status_code=400, detail="Check-out date must be after check-in date")

    # Lock the room row to prevent concurrent double-bookings
    room = db.query(RoomModel).filter(RoomModel.id == booking.roomId).with_for_update().first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room.status != "Available":
        raise HTTPException(status_code=400, detail=f"Room is not available. Current status: {room.status}")

    conflicting_booking = (
        db.query(BookingModel)
        .filter(
            and_(
                BookingModel.room_id == booking.roomId,
                BookingModel.status.in_(["Upcoming", "Checked-in"]),
                or_(
                    and_(BookingModel.check_in >= check_in, BookingModel.check_in < check_out),
                    and_(BookingModel.check_out > check_in, BookingModel.check_out <= check_out),
                    and_(BookingModel.check_in <= check_in, BookingModel.check_out >= check_out),
                ),
            )
        )
        .first()
    )

    if conflicting_booking:
        raise HTTPException(status_code=400, detail="Room is already booked for the selected dates")

    now_utc = datetime.now(timezone.utc)
    blocking_hold = db.execute(
        text(
            """
            SELECT id FROM room_holds
            WHERE room_id = :room_id
              AND expires_at > :now
              AND check_in < :check_out
              AND check_out > :check_in
              AND (:session_id IS NULL OR session_id != :session_id)
            LIMIT 1
            """
        ),
        {
            "room_id": booking.roomId,
            "now": now_utc,
            "check_in": check_in,
            "check_out": check_out,
            "session_id": booking.sessionId,
        },
    ).fetchone()
    if blocking_hold:
        raise HTTPException(
            status_code=409,
            detail="Room is temporarily held by another user. Please try again in a few minutes.",
        )

    # Pull operational info from hotel profile
    hotel = db.query(HotelProfileModel).first()
    check_out_time = (hotel.check_out_time if hotel and hotel.check_out_time else None) or "12:00"

    # Try to use hotel profile house_rules (stored as JSON text) if valid
    house_rules_from_profile: dict | None = None
    if hotel and hotel.house_rules:
        try:
            parsed = json.loads(hotel.house_rules)
            if isinstance(parsed, dict):
                house_rules_from_profile = parsed
        except (ValueError, TypeError):
            pass  # Plain text field; fall back to default struct

    db_booking = BookingModel(
        guest_name=booking.guestName,
        guest_email=booking.email,
        room_id=booking.roomId,
        room_number=booking.roomNumber,
        check_in=check_in,
        check_out=check_out,
        status=booking.status,
        notes=booking.notes,
    )
    db.add(db_booking)
    db.flush()

    token = f"guest-token-{secrets.token_urlsafe(12)}"

    contact_info = {
        "phone": hotel.phone if hotel and hotel.phone else "+1 (555) 123-4567",
        "whatsapp": hotel.phone if hotel and hotel.phone else "+1 (555) 123-4567",
        "email": booking.email if booking.email else "support@nextstay.com",
    }

    guest_token = GuestTokenModel(
        token=token,
        booking_id=db_booking.id,
        room_id=booking.roomId,
        room_number=booking.roomNumber,
        guest_name=booking.guestName,
        check_in=check_in,
        check_out=check_out,
        is_valid=True,
        access_status="Active",
        contact_info=contact_info,
        instructions={
            "accessInfo": (
                "Use the QR code at the main entrance and your room door. The code is active during your stay."
            ),
            "activeFrom": booking.checkIn,
            "activeUntil": booking.checkOut,
            "doorTroubleshooting": (
                "If the door doesn't open, ensure your phone screen is bright and "
                "hold the QR code close to the scanner. Contact support if issues persist."
            ),
        },
        house_rules=house_rules_from_profile
        or {
            "quietHours": "22:00 - 08:00",
            "checkOutTime": check_out_time,
            "smokingPolicy": "No smoking in rooms. Designated smoking areas available.",
        },
    )
    db.add(guest_token)

    if check_in.date() <= datetime.now(check_in.tzinfo).date():
        room.status = "Occupied"

    if booking.holdId and booking.sessionId:
        db.execute(
            text("DELETE FROM room_holds WHERE id = :id AND session_id = :session_id"),
            {"id": booking.holdId, "session_id": booking.sessionId},
        )

    db.commit()
    db.refresh(db_booking)
    return Booking.from_orm_with_dates(db_booking, include_token=True, db=db)


@router.patch("/bookings/{booking_id}", response_model=Booking)
def update_booking(
    booking_id: int,
    booking_update: BookingUpdate,
    db: Annotated[Session, Depends(get_db)],
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    db_booking = db.query(BookingModel).filter(BookingModel.id == booking_id).first()
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    update_data = booking_update.dict(exclude_unset=True)
    status_changing_to = None

    for field, value in update_data.items():
        if field in ["checkIn", "checkOut"]:
            try:
                if value:
                    value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except (ValueError, AttributeError) as err:
                raise HTTPException(status_code=400, detail=f"Invalid date format for {field}") from err
            setattr(
                db_booking,
                field.replace("checkIn", "check_in").replace("checkOut", "check_out"),
                value,
            )
        elif field == "guestName":
            db_booking.guest_name = value
        elif field == "roomId":
            db_booking.room_id = value
        elif field == "roomNumber":
            db_booking.room_number = value
        elif field == "status":
            # Enforce state machine
            current = db_booking.status
            allowed = VALID_STATUS_TRANSITIONS.get(current, set())
            if value not in allowed:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot transition booking from '{current}' to '{value}'. "
                    f"Allowed transitions: {sorted(allowed) or 'none (terminal state)'}.",
                )
            status_changing_to = value
            db_booking.status = value
        else:
            setattr(db_booking, field, value)

    if status_changing_to == "Checked-out":
        room = db.query(RoomModel).filter(RoomModel.id == db_booking.room_id).first()
        staff_id, staff_name = round_robin_assign(db)
        cleaning_task = TaskModel(
            room_id=db_booking.room_id,
            room_number=db_booking.room_number,
            status="In Progress" if staff_id else "Pending",
            priority="High",
            notes=f"Post-checkout cleaning — room {db_booking.room_number}",
            assigned_to=staff_id,
            assigned_to_name=staff_name,
        )
        db.add(cleaning_task)
        if room:
            room.status = "Cleaning"

    db.commit()
    db.refresh(db_booking)
    return Booking.from_orm_with_dates(db_booking, include_token=True, db=db)


@router.delete("/bookings/{booking_id}", status_code=204)
def delete_booking(
    booking_id: int,
    db: Annotated[Session, Depends(get_db)],
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    db_booking = db.query(BookingModel).filter(BookingModel.id == booking_id).first()
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    db.query(GuestTokenModel).filter(GuestTokenModel.booking_id == booking_id).delete()
    db.delete(db_booking)
    db.commit()
    return None
