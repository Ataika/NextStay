import secrets
from datetime import datetime
from typing import Annotated, List, Optional

from app.db.session import SessionLocal
from app.models.booking import Booking as BookingModel
from app.models.guest_token import GuestToken as GuestTokenModel
from app.models.room import Room as RoomModel
from app.models.user import User as UserModel
from app.security.auth import get_user_company_scope, require_roles
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

router = APIRouter(tags=["bookings"])


# Dependency to get the DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Pydantic models
class BookingBase(BaseModel):
    guestName: str
    roomId: int
    roomNumber: str
    checkIn: str
    checkOut: str
    status: str
    notes: Optional[str] = None
    email: Optional[str] = None


class BookingCreate(BaseModel):
    guestName: str
    roomId: int
    roomNumber: str
    checkIn: str
    checkOut: str
    status: str = "Pending"  # Changed default to Pending
    notes: Optional[str] = None
    email: Optional[str] = None


class BookingUpdate(BaseModel):
    guestName: Optional[str] = None
    roomId: Optional[int] = None
    roomNumber: Optional[str] = None
    checkIn: Optional[str] = None
    checkOut: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class Booking(BookingBase):
    id: int
    createdAt: str
    guestToken: Optional[str] = None  # Guest token (if exists)

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_dates(
        cls,
        obj: BookingModel,
        include_token: bool = False,
        db: Optional[Session] = None,
    ):
        """Convert ORM object to Pydantic model with correct date format"""
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


# CRUD operations
@router.get("/bookings", response_model=List[Booking])
def get_all_bookings(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[Optional[int], Query(ge=1, le=200)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    status: Annotated[Optional[str], Query()] = None,
    search: Annotated[Optional[str], Query(min_length=1)] = None,
    current_user: UserModel = Depends(require_roles("OWNER", "STAFF")),
):
    """Get bookings with optional pagination and filters."""
    company_code = get_user_company_scope(current_user)
    query = db.query(BookingModel).filter(BookingModel.company_code == company_code)
    if status:
        query = query.filter(BookingModel.status == status)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                BookingModel.guest_name.ilike(like),
                BookingModel.room_number.ilike(like),
            )
        )

    total = query.count()
    response.headers["X-Total-Count"] = str(total)

    query = query.order_by(BookingModel.created_at.desc(), BookingModel.id.desc())
    if limit is not None:
        query = query.offset(offset).limit(limit)
    bookings = query.all()
    return [Booking.from_orm_with_dates(booking, include_token=True, db=db) for booking in bookings]


@router.get("/bookings/{booking_id}", response_model=Booking)
def get_booking_by_id(
    booking_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: UserModel = Depends(require_roles("OWNER", "STAFF")),
):
    """Get booking by ID"""
    company_code = get_user_company_scope(current_user)
    booking = (
        db.query(BookingModel).filter(BookingModel.id == booking_id, BookingModel.company_code == company_code).first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return Booking.from_orm_with_dates(booking, include_token=True, db=db)


@router.post("/bookings", response_model=Booking, status_code=201)
def create_booking(booking: BookingCreate, db: Annotated[Session, Depends(get_db)]):
    """Create new booking and automatically create token for guest"""
    try:
        check_in = datetime.fromisoformat(booking.checkIn.replace("Z", "+00:00"))
        check_out = datetime.fromisoformat(booking.checkOut.replace("Z", "+00:00"))
    except (ValueError, AttributeError) as err:
        message = "Invalid date format. Use ISO format (e.g., 2026-01-20T14:00:00Z)"
        raise HTTPException(status_code=400, detail=message) from err

    # Validate dates
    now = datetime.now(check_in.tzinfo) if check_in.tzinfo else datetime.now()
    if check_in < now.replace(hour=0, minute=0, second=0, microsecond=0):
        raise HTTPException(status_code=400, detail="Check-in date cannot be in the past")

    if check_out <= check_in:
        raise HTTPException(status_code=400, detail="Check-out date must be after check-in date")

    # Check if room exists
    room = db.query(RoomModel).filter(RoomModel.id == booking.roomId).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not room.company_code:
        raise HTTPException(status_code=409, detail="Room is not assigned to a company")

    # Check if room is available
    if room.status != "Available":
        message = f"Room is not available. Current status: {room.status}"
        raise HTTPException(status_code=400, detail=message)

    # Check for conflicting bookings
    conflicting_booking = (
        db.query(BookingModel)
        .filter(
            and_(
                BookingModel.room_id == booking.roomId,
                BookingModel.status.in_(["Upcoming", "Checked-in"]),
                or_(
                    # Booking starts in our period
                    and_(BookingModel.check_in >= check_in, BookingModel.check_in < check_out),
                    # Booking ends in our period
                    and_(BookingModel.check_out > check_in, BookingModel.check_out <= check_out),
                    # Booking fully covers our period
                    and_(BookingModel.check_in <= check_in, BookingModel.check_out >= check_out),
                ),
            )
        )
        .first()
    )

    if conflicting_booking:
        raise HTTPException(status_code=400, detail="Room is already booked for the selected dates")

    # Create booking
    db_booking = BookingModel(
        guest_name=booking.guestName,
        guest_email=booking.email,
        room_id=booking.roomId,
        room_number=booking.roomNumber,
        check_in=check_in,
        check_out=check_out,
        status=booking.status,
        notes=booking.notes,
        company_code=room.company_code,
    )
    db.add(db_booking)
    db.flush()  # Get booking ID

    # Generate unique token for guest
    token = f"guest-token-{secrets.token_urlsafe(12)}"

    # Create guest token
    contact_info = {
        "phone": "+1 (555) 123-4567",
        "whatsapp": "+1 (555) 123-4567",
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
                "Use the QR code at the main entrance and your room door. " "The code is active during your stay."
            ),
            "activeFrom": booking.checkIn,
            "activeUntil": booking.checkOut,
            "doorTroubleshooting": (
                "If the door doesn't open, ensure your phone screen is bright and "
                "hold the QR code close to the scanner. Contact support if issues persist."
            ),
        },
        house_rules={
            "quietHours": "22:00 - 08:00",
            "checkOutTime": "12:00",
            "smokingPolicy": "No smoking in rooms. Designated smoking areas available.",
        },
        company_code=room.company_code,
    )
    db.add(guest_token)

    # Update room status to "Occupied" if check-in is today or in the past
    # Otherwise keep "Available" until check-in date
    if check_in.date() <= datetime.now(check_in.tzinfo).date():
        room.status = "Occupied"

    db.commit()
    db.refresh(db_booking)

    # Return booking with token
    return Booking.from_orm_with_dates(db_booking, include_token=True, db=db)


@router.patch("/bookings/{booking_id}", response_model=Booking)
def update_booking(
    booking_id: int,
    booking_update: BookingUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: UserModel = Depends(require_roles("OWNER", "STAFF")),
):
    """Update booking"""
    company_code = get_user_company_scope(current_user)
    db_booking = (
        db.query(BookingModel).filter(BookingModel.id == booking_id, BookingModel.company_code == company_code).first()
    )
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Update fields
    update_data = booking_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field in ["checkIn", "checkOut"]:
            # Convert strings to datetime
            try:
                if field == "checkIn" and value:
                    value = datetime.fromisoformat(value.replace("Z", "+00:00"))
                elif field == "checkOut" and value:
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
        else:
            setattr(db_booking, field, value)

    db.commit()
    db.refresh(db_booking)
    return Booking.from_orm_with_dates(db_booking, include_token=True, db=db)


@router.delete("/bookings/{booking_id}", status_code=204)
def delete_booking(
    booking_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: UserModel = Depends(require_roles("OWNER", "STAFF")),
):
    """Delete booking and related guest tokens"""
    company_code = get_user_company_scope(current_user)
    db_booking = (
        db.query(BookingModel).filter(BookingModel.id == booking_id, BookingModel.company_code == company_code).first()
    )
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    # First delete related guest tokens (FK on bookings.id)
    db.query(GuestTokenModel).filter(GuestTokenModel.booking_id == booking_id).delete()
    db.delete(db_booking)
    db.commit()
    return None
