from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.sql import func
from app.db.base import Base


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    guest_name = Column(String(100), nullable=False)
    guest_email = Column(String(255), nullable=True)  # Email гостя
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    room_number = Column(String(10), nullable=False)
    check_in = Column(DateTime(timezone=True), nullable=False)
    check_out = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False, default="Pending")  # Pending, Confirmed, Cancelled, Expired, Checked-in, Checked-out
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(String(500), nullable=True)
    # Stripe fields
    stripe_session_id = Column(String(255), nullable=True, index=True)
    stripe_payment_intent_id = Column(String(255), nullable=True)
    amount_paid = Column(Float, nullable=True)  # Сумма оплаты в долларах