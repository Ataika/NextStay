from app.db.base import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = {"schema": "oltp"}

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("oltp.bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    stripe_session_id = Column(String(255), nullable=True, index=True)
    stripe_payment_intent_id = Column(String(255), nullable=True, index=True)
    stripe_event_id = Column(String(255), nullable=True, unique=True, index=True)
    event_type = Column(String(100), nullable=True, index=True)
    payment_status = Column(String(50), nullable=True, index=True)
    currency = Column(String(10), nullable=True)
    amount_total_cents = Column(Integer, nullable=True)
    customer_email = Column(String(255), nullable=True, index=True)
    payload = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)
    company_code = Column(
        String(10),
        ForeignKey("oltp.companies.company_code"),
        nullable=True,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
