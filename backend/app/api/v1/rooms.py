from datetime import datetime

from app.db.session import SessionLocal
from app.models.booking import Booking as BookingModel
from app.models.room import Room as RoomModel
from app.security.auth import require_roles
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, or_, text
from sqlalchemy.orm import Session

router = APIRouter(tags=["rooms"])


# Dependency to get the DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Pydantic models for requests/responses
class RoomBase(BaseModel):
    number: str
    category: str
    status: str
    price: float
    capacity: int
    description: str | None = None
    amenities: list[str] | None = None


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    number: str | None = None
    category: str | None = None
    status: str | None = None
    price: float | None = None
    capacity: int | None = None
    description: str | None = None
    amenities: list[str] | None = None


class Room(RoomBase):
    id: int
    dynamicPrice: float | None = None
    priceSource: str | None = None
    pricingStayDate: str | None = None
    pricingSnapshotDate: str | None = None
    pricingStatus: str | None = None

    class Config:
        from_attributes = True


# Availability checking - MUST be before /rooms/{room_id} to avoid route conflicts
class AvailableRoomResponse(BaseModel):
    id: int
    number: str
    category: str
    price: float
    capacity: int
    description: str | None = None
    amenities: list[str] | None = None
    totalPrice: float
    nights: int

    class Config:
        from_attributes = True


class AvailabilityResponse(BaseModel):
    availableRooms: list[AvailableRoomResponse]
    checkIn: str
    checkOut: str


def normalize_room_type_name(value: str | None) -> str:
    return (value or "").strip().lower()


def load_latest_room_pricing(db: Session) -> dict[str, dict]:
    rows = db.execute(
        text(
            """
            WITH latest_room_type_prices AS (
                SELECT DISTINCT ON (ctx.room_type_name)
                    ctx.room_type_name,
                    pub.final_price,
                    pub.stay_date,
                    pub.snapshot_date,
                    pub.inference_status
                FROM pricing.published_prices pub
                INNER JOIN pricing.inventory_snapshots ctx
                    ON ctx.hotel_id = pub.hotel_id
                   AND ctx.room_type_id = pub.room_type_id
                   AND ctx.stay_date = pub.stay_date
                   AND ctx.snapshot_date = pub.snapshot_date
                ORDER BY
                    ctx.room_type_name,
                    pub.updated_at DESC,
                    pub.snapshot_date DESC
            )
            SELECT
                room_type_name,
                final_price,
                stay_date,
                snapshot_date,
                inference_status
            FROM latest_room_type_prices
            """
        )
    ).mappings()

    return {
        normalize_room_type_name(str(row["room_type_name"])): {
            "dynamicPrice": float(row["final_price"]) if row["final_price"] is not None else None,
            "priceSource": "model_room_type",
            "pricingStayDate": row["stay_date"].isoformat() if row["stay_date"] else None,
            "pricingSnapshotDate": row["snapshot_date"].isoformat() if row["snapshot_date"] else None,
            "pricingStatus": row["inference_status"],
        }
        for row in rows
    }


def serialize_room(room: RoomModel, pricing_map: dict[str, dict] | None = None) -> Room:
    pricing_info = (pricing_map or {}).get(normalize_room_type_name(room.category), {})
    return Room(
        id=room.id,
        number=room.number,
        category=room.category,
        status=room.status,
        price=room.price,
        capacity=room.capacity,
        description=room.description,
        amenities=room.amenities if room.amenities else [],
        dynamicPrice=pricing_info.get("dynamicPrice"),
        priceSource=pricing_info.get("priceSource"),
        pricingStayDate=pricing_info.get("pricingStayDate"),
        pricingSnapshotDate=pricing_info.get("pricingSnapshotDate"),
        pricingStatus=pricing_info.get("pricingStatus"),
    )


@router.get("/rooms/available", response_model=AvailabilityResponse)
def get_available_rooms(
    checkIn: str,
    checkOut: str,
    category: str | None = None,
    capacity: int | None = None,
    db: Session = Depends(get_db),
):
    """
    Get available rooms for the specified period

    Checks:
    - Room status (must be "Available")
    - Absence of conflicting bookings
    - Filters by category and capacity
    """
    try:
        # Parse dates
        check_in_date = datetime.fromisoformat(checkIn.replace("Z", "+00:00"))
        check_out_date = datetime.fromisoformat(checkOut.replace("Z", "+00:00"))
    except (ValueError, AttributeError) as err:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use ISO format (e.g., 2026-02-01T14:00:00Z)",
        ) from err

    # Date validation
    now = datetime.now(check_in_date.tzinfo) if check_in_date.tzinfo else datetime.now()
    if check_in_date < now.replace(hour=0, minute=0, second=0, microsecond=0):
        raise HTTPException(status_code=400, detail="Check-in date cannot be in the past")

    if check_out_date <= check_in_date:
        raise HTTPException(status_code=400, detail="Check-out date must be after check-in date")

    # Calculate number of nights
    nights = (check_out_date - check_in_date).days

    # Get all rooms with status "Available"
    query = db.query(RoomModel).filter(RoomModel.status == "Available")

    # Apply filters
    if category:
        query = query.filter(RoomModel.category == category)
    if capacity:
        query = query.filter(RoomModel.capacity >= capacity)

    all_rooms = query.all()

    # Search for conflicting bookings
    conflicting_bookings = (
        db.query(BookingModel)
        .filter(
            and_(
                BookingModel.status.in_(["Upcoming", "Checked-in"]),
                or_(
                    # Booking starts in our period
                    and_(BookingModel.check_in >= check_in_date, BookingModel.check_in < check_out_date),
                    # Booking ends in our period
                    and_(BookingModel.check_out > check_in_date, BookingModel.check_out <= check_out_date),
                    # Booking fully covers our period
                    and_(BookingModel.check_in <= check_in_date, BookingModel.check_out >= check_out_date),
                ),
            )
        )
        .all()
    )

    # Get IDs of rooms with conflicts
    conflicting_room_ids = {booking.room_id for booking in conflicting_bookings}

    # Also exclude rooms currently held by any session
    held_rows = db.execute(
        text(
            """
            SELECT DISTINCT room_id FROM room_holds
            WHERE expires_at > :now
              AND check_in < :check_out
              AND check_out > :check_in
            """
        ),
        {"now": datetime.now(), "check_in": check_in_date, "check_out": check_out_date},
    ).fetchall()
    held_room_ids = {row[0] for row in held_rows}

    # Filter available rooms
    available_rooms = [
        room for room in all_rooms if room.id not in conflicting_room_ids and room.id not in held_room_ids
    ]

    # Form response
    available_rooms_response = [
        AvailableRoomResponse(
            id=room.id,
            number=room.number,
            category=room.category,
            price=room.price,
            capacity=room.capacity,
            description=room.description,
            amenities=room.amenities if room.amenities else [],
            totalPrice=round(room.price * nights, 2),
            nights=nights,
        )
        for room in available_rooms
    ]

    return AvailabilityResponse(availableRooms=available_rooms_response, checkIn=checkIn, checkOut=checkOut)


# CRUD operations
@router.get("/rooms", response_model=list[Room])
def get_all_rooms(
    db: Session = Depends(get_db),
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    """Get all rooms"""
    rooms = db.query(RoomModel).all()
    pricing_map = load_latest_room_pricing(db)
    return [serialize_room(room, pricing_map) for room in rooms]


@router.get("/rooms/{room_id}", response_model=Room)
def get_room_by_id(
    room_id: int,
    db: Session = Depends(get_db),
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    """Get room by ID"""
    room = db.query(RoomModel).filter(RoomModel.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    pricing_map = load_latest_room_pricing(db)
    return serialize_room(room, pricing_map)


@router.post("/rooms", response_model=Room, status_code=201)
def create_room(
    room: RoomCreate,
    db: Session = Depends(get_db),
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN")),
):
    """Create a new room"""
    # Check if number is unique
    existing_room = db.query(RoomModel).filter(RoomModel.number == room.number).first()
    if existing_room:
        raise HTTPException(status_code=400, detail="Room with this number already exists")

    db_room = RoomModel(
        number=room.number,
        category=room.category,
        status=room.status,
        price=room.price,
        capacity=room.capacity,
        description=room.description,
        amenities=room.amenities,
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    pricing_map = load_latest_room_pricing(db)
    return serialize_room(db_room, pricing_map)


@router.patch("/rooms/{room_id}", response_model=Room)
def update_room(
    room_id: int,
    room_update: RoomUpdate,
    db: Session = Depends(get_db),
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    """Update room"""
    db_room = db.query(RoomModel).filter(RoomModel.id == room_id).first()
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Check if number is unique, if it's changed
    if room_update.number and room_update.number != db_room.number:
        existing_room = db.query(RoomModel).filter(RoomModel.number == room_update.number).first()
        if existing_room:
            raise HTTPException(status_code=400, detail="Room with this number already exists")

    # Update fields
    update_data = room_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_room, field, value)

    db.commit()
    db.refresh(db_room)
    pricing_map = load_latest_room_pricing(db)
    return serialize_room(db_room, pricing_map)


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN")),
):
    """Delete room"""
    db_room = db.query(RoomModel).filter(RoomModel.id == room_id).first()
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")

    db.delete(db_room)
    db.commit()
    return None
