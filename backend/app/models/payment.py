from app.db.base import Base
from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func


class Payment(Base):
    """Audit log of Stripe webhook events.

    Two roles: (1) idempotency — ``stripe_event_id`` is unique so a redelivered
    event never creates a duplicate row; (2) audit — the full event ``payload`` is
    kept. Scoped by ``hotel_id`` (derived from the booking's room).
    """

    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    stripe_event_id = Column(String(255), nullable=False, unique=True, index=True)
    event_type = Column(String(100), nullable=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="SET NULL"), nullable=True, index=True)
    stripe_session_id = Column(String(255), nullable=True, index=True)
    stripe_payment_intent_id = Column(String(255), nullable=True, index=True)
    payment_status = Column(String(50), nullable=True)
    currency = Column(String(10), nullable=True)
    amount_total_cents = Column(Integer, nullable=True)
    customer_email = Column(String(255), nullable=True, index=True)
    # JSONB on Postgres, plain JSON (TEXT) on SQLite so tests run without Postgres.
    payload = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
