"""Hotel-scoped KPI overview reports.

Computed with ORM queries + Python aggregation so it runs on both Postgres (prod)
and SQLite (tests). Scoped by ``hotel_id`` (the canonical tenancy unit), derived from
each booking's room.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.models.booking import Booking as BookingModel
from app.models.room import Room as RoomModel
from app.security.auth import require_roles
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter(tags=["reports"])

CONFIRMED = "Confirmed"
CANCELLED = "Cancelled"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ReportKpis(BaseModel):
    totalBookings: int
    confirmedBookings: int
    cancelledBookings: int
    totalRevenue: float
    avgBookingValue: float
    roomsTotal: int
    occupancyRate: float


class CategoryRevenue(BaseModel):
    category: str
    revenue: float


class TrendPoint(BaseModel):
    date: str
    bookings: int


class ReportOverviewResponse(BaseModel):
    hotelId: int
    days: int
    kpis: ReportKpis
    revenueByCategory: list[CategoryRevenue]
    bookingsTrend: list[TrendPoint]


@router.get("/reports/overview", response_model=ReportOverviewResponse)
def reports_overview(
    hotel_id: int = Query(..., description="Hotel to scope the report to"),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("OWNER")),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Bookings for this hotel within the window (scope via room.hotel_id).
    rows = (
        db.query(BookingModel, RoomModel)
        .join(RoomModel, BookingModel.room_id == RoomModel.id)
        .filter(RoomModel.hotel_id == hotel_id)
        .filter(BookingModel.created_at >= since)
        .all()
    )

    total = len(rows)
    confirmed = [b for b, _r in rows if b.status == CONFIRMED]
    cancelled = [b for b, _r in rows if b.status == CANCELLED]
    total_revenue = round(sum((b.amount_paid or 0) for b in confirmed), 2)
    avg_value = round(total_revenue / len(confirmed), 2) if confirmed else 0.0

    rooms_total = db.query(RoomModel).filter(RoomModel.hotel_id == hotel_id).count()
    rooms_booked = len({b.room_id for b in confirmed})
    occupancy = round(rooms_booked / rooms_total, 4) if rooms_total else 0.0

    # Revenue by room category (confirmed only).
    cat_rev: dict[str, float] = defaultdict(float)
    for booking, room in rows:
        if booking.status == CONFIRMED:
            cat_rev[room.category or "Unknown"] += booking.amount_paid or 0
    revenue_by_category = [
        CategoryRevenue(category=cat, revenue=round(rev, 2))
        for cat, rev in sorted(cat_rev.items(), key=lambda kv: kv[1], reverse=True)
    ]

    # Per-day booking counts over the window.
    per_day: dict[str, int] = defaultdict(int)
    for booking, _room in rows:
        if booking.created_at is not None:
            per_day[booking.created_at.date().isoformat()] += 1
    bookings_trend = [TrendPoint(date=d, bookings=c) for d, c in sorted(per_day.items())]

    return ReportOverviewResponse(
        hotelId=hotel_id,
        days=days,
        kpis=ReportKpis(
            totalBookings=total,
            confirmedBookings=len(confirmed),
            cancelledBookings=len(cancelled),
            totalRevenue=total_revenue,
            avgBookingValue=avg_value,
            roomsTotal=rooms_total,
            occupancyRate=occupancy,
        ),
        revenueByCategory=revenue_by_category,
        bookingsTrend=bookings_trend,
    )
