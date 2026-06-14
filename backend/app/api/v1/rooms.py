from datetime import datetime
from pathlib import Path
from uuid import uuid4

from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.room import Room as RoomModel
from app.services.room_availability import get_available_rooms_for_stay, parse_booking_dates
from app.models.user import User as UserModel
from app.security.auth import require_roles
from app.security.tenancy import require_hotel_id
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

router = APIRouter(tags=["rooms"])
logger = get_logger(__name__)

ROOM_PHOTOS_DIR = Path(__file__).resolve().parents[3] / "uploads" / "rooms"
MAX_ROOM_PHOTO_BYTES = 5 * 1024 * 1024
ALLOWED_ROOM_PHOTO_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

VALID_ROOM_STATUSES = {"Available", "Occupied", "Cleaning", "Out of Service"}
ACCEPTED_ROOM_STATUSES = VALID_ROOM_STATUSES | {"Maintenance"}


def normalize_status_for_db(status: str) -> str:
    if status == "Maintenance":
        return "Out of Service"
    return status


def normalize_status_for_api(status: str) -> str:
    if status == "Out of Service":
        return "Maintenance"
    return status


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class RoomBase(BaseModel):
    number: str = Field(..., min_length=1, max_length=20)
    category: str = Field(..., min_length=1, max_length=50)
    status: str
    price: float = Field(..., gt=0, description="Nightly price in hotel currency, must be positive")
    capacity: int = Field(..., ge=1)
    description: str | None = None
    amenities: list[str] | None = None
    photoUrl: str | None = None
    areaSqm: int | None = Field(None, ge=1)
    bedType: str | None = None
    viewType: str | None = None
    floor: int | None = Field(None, ge=0)


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    number: str | None = Field(None, min_length=1, max_length=20)
    category: str | None = Field(None, min_length=1, max_length=50)
    status: str | None = None
    price: float | None = Field(None, gt=0)
    capacity: int | None = Field(None, ge=1)
    description: str | None = None
    amenities: list[str] | None = None
    photoUrl: str | None = None
    areaSqm: int | None = Field(None, ge=1)
    bedType: str | None = None
    viewType: str | None = None
    floor: int | None = Field(None, ge=0)


class Room(RoomBase):
    id: int
    dynamicPrice: float | None = None
    priceSource: str | None = None
    pricingStayDate: str | None = None
    pricingSnapshotDate: str | None = None
    pricingStatus: str | None = None

    class Config:
        from_attributes = True


class AvailableRoomResponse(BaseModel):
    id: int
    number: str
    category: str
    price: float
    capacity: int
    description: str | None = None
    amenities: list[str] | None = None
    photoUrl: str | None = None
    bedType: str | None = None
    viewType: str | None = None
    areaSqm: int | None = None
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
    try:
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
    except Exception:
        logger.warning("Failed to load room pricing from pricing schema.", exc_info=True)
        db.rollback()
        return {}

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
        status=normalize_status_for_api(room.status),
        price=room.price,
        capacity=room.capacity,
        description=room.description,
        amenities=room.amenities if room.amenities else [],
        photoUrl=room.photo_url,
        areaSqm=room.area_sqm,
        bedType=room.bed_type,
        viewType=room.view_type,
        floor=room.floor,
        dynamicPrice=pricing_info.get("dynamicPrice"),
        priceSource=pricing_info.get("priceSource"),
        pricingStayDate=pricing_info.get("pricingStayDate"),
        pricingSnapshotDate=pricing_info.get("pricingSnapshotDate"),
        pricingStatus=pricing_info.get("pricingStatus"),
    )


def _room_payload_to_model_fields(payload: dict) -> dict:
    field_map = {
        "photoUrl": "photo_url",
        "areaSqm": "area_sqm",
        "bedType": "bed_type",
        "viewType": "view_type",
    }
    model_fields: dict = {}
    for key, value in payload.items():
        if key == "status" and value is not None:
            if value not in ACCEPTED_ROOM_STATUSES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid status. Must be one of: {sorted(ACCEPTED_ROOM_STATUSES)}",
                )
            model_fields["status"] = normalize_status_for_db(value)
            continue
        model_fields[field_map.get(key, key)] = value
    return model_fields


@router.get("/rooms/available", response_model=AvailabilityResponse)
def get_available_rooms(
    checkIn: str,
    checkOut: str,
    category: str | None = None,
    capacity: int | None = None,
    hotelId: int | None = Query(default=None, alias="hotelId"),
    db: Session = Depends(get_db),
):
    try:
        check_in_date, check_out_date, nights = parse_booking_dates(checkIn, checkOut)
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

    available_rooms, nights = get_available_rooms_for_stay(
        db,
        check_in_date,
        check_out_date,
        hotel_id=hotelId,
        category=category,
        capacity=capacity,
    )

    return AvailabilityResponse(
        availableRooms=[
            AvailableRoomResponse(
                id=room.id,
                number=room.number,
                category=room.category,
                price=room.price,
                capacity=room.capacity,
                description=room.description,
                amenities=room.amenities if room.amenities else [],
                photoUrl=room.photo_url,
                bedType=room.bed_type,
                viewType=room.view_type,
                areaSqm=room.area_sqm,
                totalPrice=round(room.price * nights, 2),
                nights=nights,
            )
            for room in available_rooms
        ],
        checkIn=checkIn,
        checkOut=checkOut,
    )


@router.get("/rooms", response_model=list[Room])
def get_all_rooms(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    hotel_id = require_hotel_id(current_user, db)
    rooms = db.query(RoomModel).filter(RoomModel.hotel_id == hotel_id).all()
    pricing_map = load_latest_room_pricing(db)
    return [serialize_room(room, pricing_map) for room in rooms]


@router.get("/rooms/{room_id}", response_model=Room)
def get_room_by_id(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    hotel_id = require_hotel_id(current_user, db)
    room = db.query(RoomModel).filter(RoomModel.id == room_id, RoomModel.hotel_id == hotel_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    pricing_map = load_latest_room_pricing(db)
    return serialize_room(room, pricing_map)


@router.post("/rooms", response_model=Room, status_code=201)
def create_room(
    room: RoomCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles("OWNER", "SYS_ADMIN")),
):
    hotel_id = require_hotel_id(current_user, db)
    if room.status not in ACCEPTED_ROOM_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {sorted(ACCEPTED_ROOM_STATUSES)}",
        )
    existing_room = (
        db.query(RoomModel)
        .filter(RoomModel.hotel_id == hotel_id, RoomModel.number == room.number)
        .first()
    )
    if existing_room:
        raise HTTPException(status_code=400, detail="Room with this number already exists")

    db_room = RoomModel(
        hotel_id=hotel_id,
        number=room.number,
        category=room.category,
        status=normalize_status_for_db(room.status),
        price=room.price,
        capacity=room.capacity,
        description=room.description,
        amenities=room.amenities,
        photo_url=room.photoUrl,
        area_sqm=room.areaSqm,
        bed_type=room.bedType,
        view_type=room.viewType,
        floor=room.floor,
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
    current_user: UserModel = Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    hotel_id = require_hotel_id(current_user, db)
    db_room = db.query(RoomModel).filter(RoomModel.id == room_id, RoomModel.hotel_id == hotel_id).first()
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room_update.status is not None and room_update.status not in ACCEPTED_ROOM_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {sorted(ACCEPTED_ROOM_STATUSES)}",
        )

    if room_update.number and room_update.number != db_room.number:
        existing_room = (
            db.query(RoomModel)
            .filter(RoomModel.hotel_id == hotel_id, RoomModel.number == room_update.number)
            .first()
        )
        if existing_room:
            raise HTTPException(status_code=400, detail="Room with this number already exists")

    update_data = room_update.dict(exclude_unset=True)
    model_fields = _room_payload_to_model_fields(update_data)
    for field, value in model_fields.items():
        setattr(db_room, field, value)

    db.commit()
    db.refresh(db_room)
    pricing_map = load_latest_room_pricing(db)
    return serialize_room(db_room, pricing_map)


class RoomPhotoUploadResponse(BaseModel):
    url: str


@router.post("/rooms/upload-photo", response_model=RoomPhotoUploadResponse, status_code=201)
async def upload_room_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    require_hotel_id(current_user, db)
    content_type = (file.content_type or "").lower()
    extension = ALLOWED_ROOM_PHOTO_TYPES.get(content_type)
    if not extension:
        raise HTTPException(status_code=400, detail="Unsupported image type. Use JPEG, PNG, WebP, or GIF.")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(payload) > MAX_ROOM_PHOTO_BYTES:
        raise HTTPException(status_code=400, detail="Image is too large. Maximum size is 5 MB.")

    ROOM_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    destination = ROOM_PHOTOS_DIR / filename
    destination.write_bytes(payload)

    return RoomPhotoUploadResponse(url=f"/api/v1/uploads/rooms/{filename}")


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles("OWNER", "SYS_ADMIN")),
):
    hotel_id = require_hotel_id(current_user, db)
    db_room = db.query(RoomModel).filter(RoomModel.id == room_id, RoomModel.hotel_id == hotel_id).first()
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")

    db.delete(db_room)
    db.commit()
    return None
