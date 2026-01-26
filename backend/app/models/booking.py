from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    guest_name = Column(String(100), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    room_number = Column(String(10), nullable=False)
    check_in = Column(DateTime(timezone=True), nullable=False)
    check_out = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False, default="Upcoming")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(String(500), nullable=True)
