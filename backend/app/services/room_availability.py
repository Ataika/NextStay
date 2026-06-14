from __future__ import annotations

from datetime import datetime

from app.core.utils import count_stay_nights
from app.models.booking import Booking as BookingModel
from app.models.room import Room as RoomModel
from sqlalchemy import and_, or_, text
from sqlalchemy.orm import Session


def parse_booking_dates(check_in: str, check_out: str) -> tuple[datetime, datetime, int]:
    check_in_date = datetime.fromisoformat(check_in.replace("Z", "+00:00"))
    check_out_date = datetime.fromisoformat(check_out.replace("Z", "+00:00"))
    nights = count_stay_nights(check_in_date, check_out_date)
    return check_in_date, check_out_date, nights


def get_available_rooms_for_stay(
    db: Session,
    check_in_date: datetime,
    check_out_date: datetime,
    *,
    hotel_id: int | None = None,
    category: str | None = None,
    capacity: int | None = None,
) -> tuple[list[RoomModel], int]:
    nights = count_stay_nights(check_in_date, check_out_date)

    query = db.query(RoomModel).filter(RoomModel.status == "Available")
    if hotel_id is not None:
        query = query.filter(RoomModel.hotel_id == hotel_id)
    if category:
        query = query.filter(RoomModel.category == category)
    if capacity:
        query = query.filter(RoomModel.capacity >= capacity)

    all_rooms = query.all()

    conflicting_bookings = (
        db.query(BookingModel)
        .filter(
            and_(
                BookingModel.status.in_(["Upcoming", "Checked-in"]),
                or_(
                    and_(BookingModel.check_in >= check_in_date, BookingModel.check_in < check_out_date),
                    and_(BookingModel.check_out > check_in_date, BookingModel.check_out <= check_out_date),
                    and_(BookingModel.check_in <= check_in_date, BookingModel.check_out >= check_out_date),
                ),
            )
        )
        .all()
    )

    conflicting_room_ids = {booking.room_id for booking in conflicting_bookings}

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

    available_rooms = [
        room for room in all_rooms if room.id not in conflicting_room_ids and room.id not in held_room_ids
    ]
    return available_rooms, nights
