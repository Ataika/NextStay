import json
import secrets
from datetime import datetime, timezone
from typing import Annotated, Any

from app.core.config import HOTEL_SYNC_TOKEN, HOTEL_SYNC_TOKEN_ENABLED
from app.db.session import SessionLocal
from app.models.booking import Booking as BookingModel
from app.models.guest_token import GuestToken as GuestTokenModel
from app.models.room import Room as RoomModel
from app.security.auth import require_roles
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, or_, text
from sqlalchemy.orm import Session

router = APIRouter(tags=["hotel-sync"])

ACTIVE_BOOKING_STATUSES = ["Pending", "Confirmed", "Upcoming", "Checked-in"]
VALID_ROOM_STATUSES = {"Available", "Occupied", "Cleaning", "Maintenance", "Dirty"}
VALID_EVENT_TYPES = {"booking_created", "booking_cancelled", "room_status_updated"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_hotel_sync_token(x_hotel_sync_token: str | None = Header(None)):
    if not HOTEL_SYNC_TOKEN_ENABLED:
        return
    if not HOTEL_SYNC_TOKEN or x_hotel_sync_token != HOTEL_SYNC_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid hotel sync token.",
        )


class HotelSyncEventRequest(BaseModel):
    eventId: str
    hotelId: int = 1
    source: str = "hotel_site_simulator"
    type: str
    externalBookingId: str | None = None
    roomId: int | None = None
    roomNumber: str | None = None
    guestName: str | None = None
    guestEmail: str | None = None
    checkIn: str | None = None
    checkOut: str | None = None
    amountPaid: float | None = None
    status: str | None = None


class HotelSyncResponse(BaseModel):
    eventId: str
    eventStatus: str
    action: str
    bookingId: int | None = None
    roomId: int | None = None
    roomNumber: str | None = None
    externalBookingId: str | None = None
    bookingStatus: str | None = None
    guestToken: str | None = None
    message: str


class HotelSyncEventLog(BaseModel):
    id: int
    hotelId: int
    externalEventId: str
    source: str
    eventType: str
    status: str
    error: str | None
    bookingId: int | None
    receivedAt: str
    processedAt: str | None


class HotelChannelBookingLog(BaseModel):
    id: int
    hotelId: int
    externalBookingId: str
    bookingId: int | None
    roomId: int | None
    roomNumber: str
    source: str
    status: str
    checkIn: str | None
    checkOut: str | None
    guestName: str | None
    guestEmail: str | None
    syncedAt: str
    cancelledAt: str | None


def dump_model(model: BaseModel) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def parse_datetime(value: str | None, field_name: str) -> datetime:
    if not value:
        raise HTTPException(status_code=422, detail=f"{field_name} is required.")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as err:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}. Use ISO datetime.") from err
    return parsed


def now_for(value: datetime) -> datetime:
    return datetime.now(value.tzinfo) if value.tzinfo else datetime.now()


def synced_booking_status(check_in: datetime, check_out: datetime) -> str:
    now = now_for(check_in)
    if check_out <= now:
        raise HTTPException(status_code=400, detail="Cannot sync a booking that already ended.")
    if check_in <= now < check_out:
        return "Checked-in"
    return "Upcoming"


def ensure_sync_tables(db: Session) -> None:
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS public.hotel_sync_events (
                id SERIAL PRIMARY KEY,
                hotel_id INTEGER NOT NULL DEFAULT 1,
                external_event_id TEXT NOT NULL UNIQUE,
                source TEXT NOT NULL DEFAULT 'hotel_site_simulator',
                event_type TEXT NOT NULL,
                payload JSONB NOT NULL,
                status TEXT NOT NULL DEFAULT 'received',
                error TEXT,
                booking_id INTEGER REFERENCES public.bookings(id) ON DELETE SET NULL,
                received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                processed_at TIMESTAMPTZ,
                CONSTRAINT hotel_sync_events_status_chk
                    CHECK (status IN ('received', 'processed', 'failed')),
                CONSTRAINT hotel_sync_events_type_chk
                    CHECK (event_type IN ('booking_created', 'booking_cancelled', 'room_status_updated'))
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS public.hotel_channel_bookings (
                id SERIAL PRIMARY KEY,
                hotel_id INTEGER NOT NULL DEFAULT 1,
                external_booking_id TEXT NOT NULL,
                booking_id INTEGER REFERENCES public.bookings(id) ON DELETE SET NULL,
                room_id INTEGER REFERENCES public.rooms(id) ON DELETE SET NULL,
                room_number VARCHAR(10) NOT NULL,
                source TEXT NOT NULL DEFAULT 'hotel_site_simulator',
                status TEXT NOT NULL DEFAULT 'active',
                check_in TIMESTAMPTZ,
                check_out TIMESTAMPTZ,
                guest_name VARCHAR(100),
                guest_email VARCHAR(255),
                synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                cancelled_at TIMESTAMPTZ,
                CONSTRAINT hotel_channel_bookings_status_chk
                    CHECK (status IN ('active', 'cancelled')),
                CONSTRAINT hotel_channel_bookings_unique_external
                    UNIQUE (hotel_id, external_booking_id)
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS idx_hotel_sync_events_hotel_received
                ON public.hotel_sync_events(hotel_id, received_at DESC);
            CREATE INDEX IF NOT EXISTS idx_hotel_sync_events_booking
                ON public.hotel_sync_events(booking_id);
            CREATE INDEX IF NOT EXISTS idx_hotel_channel_bookings_booking
                ON public.hotel_channel_bookings(booking_id);
            CREATE INDEX IF NOT EXISTS idx_hotel_channel_bookings_room_dates
                ON public.hotel_channel_bookings(room_id, check_in, check_out);
            """
        )
    )


def create_guest_token(db: Session, booking: BookingModel) -> str:
    token = f"guest-token-{secrets.token_urlsafe(12)}"
    guest_token = GuestTokenModel(
        token=token,
        booking_id=booking.id,
        room_id=booking.room_id,
        room_number=booking.room_number,
        guest_name=booking.guest_name,
        check_in=booking.check_in,
        check_out=booking.check_out,
        is_valid=True,
        access_status="Active",
        contact_info={
            "phone": "+1 (555) 123-4567",
            "whatsapp": "+1 (555) 123-4567",
            "email": booking.guest_email or "support@nextstay.com",
        },
        instructions={
            "accessInfo": "Use the QR code at the main entrance and your room door.",
            "activeFrom": booking.check_in.isoformat(),
            "activeUntil": booking.check_out.isoformat(),
            "doorTroubleshooting": "Contact reception if the QR code does not open the door.",
        },
        house_rules={
            "quietHours": "22:00 - 08:00",
            "checkOutTime": "12:00",
            "smokingPolicy": "No smoking in rooms. Designated smoking areas available.",
        },
    )
    db.add(guest_token)
    return token


def find_room(db: Session, event: HotelSyncEventRequest) -> RoomModel:
    if event.roomId is not None:
        room = db.query(RoomModel).filter(RoomModel.id == event.roomId).first()
    elif event.roomNumber:
        room = db.query(RoomModel).filter(RoomModel.number == event.roomNumber).first()
    else:
        raise HTTPException(status_code=422, detail="roomId or roomNumber is required.")

    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")
    return room


def has_conflicting_booking(db: Session, room_id: int, check_in: datetime, check_out: datetime) -> bool:
    conflict = (
        db.query(BookingModel)
        .filter(
            and_(
                BookingModel.room_id == room_id,
                BookingModel.status.in_(ACTIVE_BOOKING_STATUSES),
                or_(
                    and_(BookingModel.check_in >= check_in, BookingModel.check_in < check_out),
                    and_(BookingModel.check_out > check_in, BookingModel.check_out <= check_out),
                    and_(BookingModel.check_in <= check_in, BookingModel.check_out >= check_out),
                ),
            )
        )
        .first()
    )
    return conflict is not None


def existing_channel_mapping(db: Session, hotel_id: int, external_booking_id: str):
    return (
        db.execute(
            text(
                """
                SELECT id, booking_id, room_id, room_number, status
                FROM public.hotel_channel_bookings
                WHERE hotel_id = :hotel_id AND external_booking_id = :external_booking_id
                """
            ),
            {"hotel_id": hotel_id, "external_booking_id": external_booking_id},
        )
        .mappings()
        .first()
    )


def process_booking_created(db: Session, event: HotelSyncEventRequest) -> HotelSyncResponse:
    if not event.externalBookingId:
        raise HTTPException(status_code=422, detail="externalBookingId is required.")
    if not event.guestName:
        raise HTTPException(status_code=422, detail="guestName is required.")

    mapping = existing_channel_mapping(db, event.hotelId, event.externalBookingId)
    if mapping and mapping["booking_id"]:
        return HotelSyncResponse(
            eventId=event.eventId,
            eventStatus="processed",
            action="duplicate_booking_ignored",
            bookingId=mapping["booking_id"],
            roomId=mapping["room_id"],
            roomNumber=mapping["room_number"],
            externalBookingId=event.externalBookingId,
            message="External booking was already synchronized.",
        )

    check_in = parse_datetime(event.checkIn, "checkIn")
    check_out = parse_datetime(event.checkOut, "checkOut")
    if check_out <= check_in:
        raise HTTPException(status_code=400, detail="checkOut must be after checkIn.")

    room = find_room(db, event)
    if room.status in {"Cleaning", "Maintenance", "Dirty"}:
        raise HTTPException(status_code=409, detail=f"Room is not sellable. Current status: {room.status}.")

    if has_conflicting_booking(db, room.id, check_in, check_out):
        raise HTTPException(status_code=409, detail="Room already has an active booking for these dates.")

    booking_status = synced_booking_status(check_in, check_out)
    booking = BookingModel(
        guest_name=event.guestName,
        guest_email=event.guestEmail,
        room_id=room.id,
        room_number=room.number,
        check_in=check_in,
        check_out=check_out,
        status=booking_status,
        notes=f"Synced from {event.source}; external booking id: {event.externalBookingId}",
        amount_paid=event.amountPaid,
    )
    db.add(booking)
    db.flush()

    guest_token = create_guest_token(db, booking)

    if booking_status == "Checked-in":
        room.status = "Occupied"

    db.execute(
        text(
            """
            INSERT INTO public.hotel_channel_bookings (
                hotel_id, external_booking_id, booking_id, room_id, room_number,
                source, status, check_in, check_out, guest_name, guest_email
            )
            VALUES (
                :hotel_id, :external_booking_id, :booking_id, :room_id, :room_number,
                :source, 'active', :check_in, :check_out, :guest_name, :guest_email
            )
            """
        ),
        {
            "hotel_id": event.hotelId,
            "external_booking_id": event.externalBookingId,
            "booking_id": booking.id,
            "room_id": room.id,
            "room_number": room.number,
            "source": event.source,
            "check_in": check_in,
            "check_out": check_out,
            "guest_name": event.guestName,
            "guest_email": event.guestEmail,
        },
    )

    return HotelSyncResponse(
        eventId=event.eventId,
        eventStatus="processed",
        action="booking_created",
        bookingId=booking.id,
        roomId=room.id,
        roomNumber=room.number,
        externalBookingId=event.externalBookingId,
        bookingStatus=booking.status,
        guestToken=guest_token,
        message="External hotel booking was synchronized into NextStay.",
    )


def process_booking_cancelled(db: Session, event: HotelSyncEventRequest) -> HotelSyncResponse:
    if not event.externalBookingId:
        raise HTTPException(status_code=422, detail="externalBookingId is required.")

    mapping = existing_channel_mapping(db, event.hotelId, event.externalBookingId)
    if not mapping or not mapping["booking_id"]:
        raise HTTPException(status_code=404, detail="External booking mapping was not found.")

    booking = db.query(BookingModel).filter(BookingModel.id == mapping["booking_id"]).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    booking.status = "Cancelled"
    db.query(GuestTokenModel).filter(GuestTokenModel.booking_id == booking.id).update(
        {"is_valid": False, "access_status": "Expired"}
    )
    db.execute(
        text(
            """
            UPDATE public.hotel_channel_bookings
            SET status = 'cancelled', cancelled_at = NOW(), synced_at = NOW()
            WHERE hotel_id = :hotel_id AND external_booking_id = :external_booking_id
            """
        ),
        {"hotel_id": event.hotelId, "external_booking_id": event.externalBookingId},
    )

    room = db.query(RoomModel).filter(RoomModel.id == booking.room_id).first()
    if room and room.status == "Occupied":
        now = datetime.now(booking.check_in.tzinfo or timezone.utc)
        active_current = (
            db.query(BookingModel)
            .filter(
                BookingModel.id != booking.id,
                BookingModel.room_id == booking.room_id,
                BookingModel.status == "Checked-in",
                BookingModel.check_in <= now,
                BookingModel.check_out > now,
            )
            .first()
        )
        if not active_current:
            room.status = "Available"

    return HotelSyncResponse(
        eventId=event.eventId,
        eventStatus="processed",
        action="booking_cancelled",
        bookingId=booking.id,
        roomId=booking.room_id,
        roomNumber=booking.room_number,
        externalBookingId=event.externalBookingId,
        bookingStatus=booking.status,
        message="External hotel booking cancellation was synchronized into NextStay.",
    )


def process_room_status_updated(db: Session, event: HotelSyncEventRequest) -> HotelSyncResponse:
    if not event.status or event.status not in VALID_ROOM_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of: {sorted(VALID_ROOM_STATUSES)}.")

    room = find_room(db, event)
    room.status = event.status

    return HotelSyncResponse(
        eventId=event.eventId,
        eventStatus="processed",
        action="room_status_updated",
        roomId=room.id,
        roomNumber=room.number,
        message="External room status update was synchronized into NextStay.",
    )


def create_event_record(db: Session, event: HotelSyncEventRequest):
    payload = dump_model(event)
    row = (
        db.execute(
            text(
                """
                INSERT INTO public.hotel_sync_events (
                    hotel_id, external_event_id, source, event_type, payload, status
                )
                VALUES (
                    :hotel_id, :external_event_id, :source, :event_type,
                    CAST(:payload AS JSONB), 'received'
                )
                ON CONFLICT (external_event_id) DO NOTHING
                RETURNING id
                """
            ),
            {
                "hotel_id": event.hotelId,
                "external_event_id": event.eventId,
                "source": event.source,
                "event_type": event.type,
                "payload": json.dumps(payload),
            },
        )
        .mappings()
        .first()
    )
    if row:
        return row["id"], None

    duplicate = (
        db.execute(
            text(
                """
                SELECT id, status, booking_id, processed_at
                FROM public.hotel_sync_events
                WHERE external_event_id = :external_event_id
                """
            ),
            {"external_event_id": event.eventId},
        )
        .mappings()
        .first()
    )
    return None, duplicate


def mark_event_processed(db: Session, event_id: int, booking_id: int | None) -> None:
    db.execute(
        text(
            """
            UPDATE public.hotel_sync_events
            SET status = 'processed',
                booking_id = :booking_id,
                processed_at = NOW(),
                error = NULL
            WHERE id = :event_id
            """
        ),
        {"event_id": event_id, "booking_id": booking_id},
    )


def mark_event_failed(db: Session, event_id: int, error: str) -> None:
    db.execute(
        text(
            """
            UPDATE public.hotel_sync_events
            SET status = 'failed',
                error = :error,
                processed_at = NOW()
            WHERE id = :event_id
            """
        ),
        {"event_id": event_id, "error": error[:500]},
    )
    db.commit()


@router.post("/hotel-sync/events", response_model=HotelSyncResponse, status_code=202)
def receive_hotel_sync_event(
    event: HotelSyncEventRequest,
    db: Annotated[Session, Depends(get_db)],
    _token=Depends(require_hotel_sync_token),
):
    ensure_sync_tables(db)

    if event.type not in VALID_EVENT_TYPES:
        raise HTTPException(status_code=422, detail=f"type must be one of: {sorted(VALID_EVENT_TYPES)}.")

    event_id, duplicate = create_event_record(db, event)
    db.commit()
    if duplicate:
        return HotelSyncResponse(
            eventId=event.eventId,
            eventStatus=duplicate["status"],
            action="duplicate_event_ignored",
            bookingId=duplicate["booking_id"],
            externalBookingId=event.externalBookingId,
            message="Event id was already received. No second write was performed.",
        )

    try:
        if event.type == "booking_created":
            response = process_booking_created(db, event)
        elif event.type == "booking_cancelled":
            response = process_booking_cancelled(db, event)
        else:
            response = process_room_status_updated(db, event)

        mark_event_processed(db, event_id, response.bookingId)
        db.commit()
        return response
    except HTTPException as err:
        db.rollback()
        mark_event_failed(db, event_id, str(err.detail))
        raise
    except Exception as err:
        db.rollback()
        mark_event_failed(db, event_id, str(err))
        raise HTTPException(status_code=500, detail="Hotel sync event failed.") from err


@router.get("/hotel-sync/events", response_model=list[HotelSyncEventLog])
def list_hotel_sync_events(
    db: Annotated[Session, Depends(get_db)],
    limit: int = 25,
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    ensure_sync_tables(db)
    rows = (
        db.execute(
            text(
                """
                SELECT id, hotel_id, external_event_id, source, event_type, status,
                       error, booking_id, received_at, processed_at
                FROM public.hotel_sync_events
                ORDER BY received_at DESC
                LIMIT :limit
                """
            ),
            {"limit": min(max(limit, 1), 100)},
        )
        .mappings()
        .all()
    )
    return [
        HotelSyncEventLog(
            id=row["id"],
            hotelId=row["hotel_id"],
            externalEventId=row["external_event_id"],
            source=row["source"],
            eventType=row["event_type"],
            status=row["status"],
            error=row["error"],
            bookingId=row["booking_id"],
            receivedAt=row["received_at"].isoformat(),
            processedAt=row["processed_at"].isoformat() if row["processed_at"] else None,
        )
        for row in rows
    ]


@router.get("/hotel-sync/channel-bookings", response_model=list[HotelChannelBookingLog])
def list_channel_bookings(
    db: Annotated[Session, Depends(get_db)],
    limit: int = 25,
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    ensure_sync_tables(db)
    rows = (
        db.execute(
            text(
                """
                SELECT id, hotel_id, external_booking_id, booking_id, room_id, room_number,
                       source, status, check_in, check_out, guest_name, guest_email,
                       synced_at, cancelled_at
                FROM public.hotel_channel_bookings
                ORDER BY synced_at DESC
                LIMIT :limit
                """
            ),
            {"limit": min(max(limit, 1), 100)},
        )
        .mappings()
        .all()
    )
    return [
        HotelChannelBookingLog(
            id=row["id"],
            hotelId=row["hotel_id"],
            externalBookingId=row["external_booking_id"],
            bookingId=row["booking_id"],
            roomId=row["room_id"],
            roomNumber=row["room_number"],
            source=row["source"],
            status=row["status"],
            checkIn=row["check_in"].isoformat() if row["check_in"] else None,
            checkOut=row["check_out"].isoformat() if row["check_out"] else None,
            guestName=row["guest_name"],
            guestEmail=row["guest_email"],
            syncedAt=row["synced_at"].isoformat(),
            cancelledAt=row["cancelled_at"].isoformat() if row["cancelled_at"] else None,
        )
        for row in rows
    ]
