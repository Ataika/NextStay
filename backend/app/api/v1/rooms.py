from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, date
from app.db.session import SessionLocal
from app.models.room import Room as RoomModel
from app.models.booking import Booking as BookingModel

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
    description: Optional[str] = None
    amenities: Optional[List[str]] = None


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    number: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    price: Optional[float] = None
    capacity: Optional[int] = None
    description: Optional[str] = None
    amenities: Optional[List[str]] = None


class Room(RoomBase):
    id: int

    class Config:
        from_attributes = True


# Availability checking - MUST be before /rooms/{room_id} to avoid route conflicts
class AvailableRoomResponse(BaseModel):
    id: int
    number: str
    category: str
    price: float
    capacity: int
    description: Optional[str] = None
    amenities: Optional[List[str]] = None
    totalPrice: float
    nights: int

    class Config:
        from_attributes = True


class AvailabilityResponse(BaseModel):
    availableRooms: List[AvailableRoomResponse]
    checkIn: str
    checkOut: str


@router.get("/rooms/available", response_model=AvailabilityResponse)
def get_available_rooms(
    checkIn: str,
    checkOut: str,
    category: Optional[str] = None,
    capacity: Optional[int] = None,
    db: Session = Depends(get_db)
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
        check_in_date = datetime.fromisoformat(checkIn.replace('Z', '+00:00'))
        check_out_date = datetime.fromisoformat(checkOut.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use ISO format (e.g., 2026-02-01T14:00:00Z)"
        )
    
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
    conflicting_bookings = db.query(BookingModel).filter(
        and_(
            BookingModel.status.in_(["Upcoming", "Checked-in"]),
            or_(
                # Booking starts in our period
                and_(
                    BookingModel.check_in >= check_in_date,
                    BookingModel.check_in < check_out_date
                ),
                # Booking ends in our period
                and_(
                    BookingModel.check_out > check_in_date,
                    BookingModel.check_out <= check_out_date
                ),
                # Booking fully covers our period
                and_(
                    BookingModel.check_in <= check_in_date,
                    BookingModel.check_out >= check_out_date
                )
            )
        )
    ).all()
    
    # Get IDs of rooms with conflicts
    conflicting_room_ids = {booking.room_id for booking in conflicting_bookings}
    
    # Filter available rooms
    available_rooms = [
        room for room in all_rooms
        if room.id not in conflicting_room_ids
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
            nights=nights
        )
        for room in available_rooms
    ]
    
    return AvailabilityResponse(
        availableRooms=available_rooms_response,
        checkIn=checkIn,
        checkOut=checkOut
    )


# CRUD operations
@router.get("/rooms", response_model=List[Room])
def get_all_rooms(db: Session = Depends(get_db)):
    """Get all rooms"""
    rooms = db.query(RoomModel).all()
    return rooms


@router.get("/rooms/{room_id}", response_model=Room)
def get_room_by_id(room_id: int, db: Session = Depends(get_db)):
    """Get room by ID"""
    room = db.query(RoomModel).filter(RoomModel.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


@router.post("/rooms", response_model=Room, status_code=201)
def create_room(room: RoomCreate, db: Session = Depends(get_db)):
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
        amenities=room.amenities
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room


@router.patch("/rooms/{room_id}", response_model=Room)
def update_room(room_id: int, room_update: RoomUpdate, db: Session = Depends(get_db)):
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
    return db_room


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(room_id: int, db: Session = Depends(get_db)):
    """Delete room"""
    db_room = db.query(RoomModel).filter(RoomModel.id == room_id).first()
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    db.delete(db_room)
    db.commit()
    return None
