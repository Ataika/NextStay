from app.db.base import Base
from sqlalchemy import Column, DateTime, Double, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func


class HotelProfile(Base):
    __tablename__ = "hotel_profile"

    # Shared-PK 1:1 extension of the canonical `hotels` entity: hotel_profile.id IS hotels.id.
    # `hotels` carries identity + sync config; `hotel_profile` carries the descriptive profile.
    # autoincrement=True keeps standalone creation working (tests/SQLite); the registration flow
    # sets id explicitly to the matching hotels.id so the 1:1 alignment holds on the live DB.
    id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), primary_key=True, autoincrement=True, index=True)
    hotel_name = Column(String(255), nullable=False, default="My Hotel")
    city = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    lat = Column(Double, nullable=True)
    lng = Column(Double, nullable=True)
    currency = Column(String(3), nullable=True)  # ISO 4217, e.g. "EUR"
    phone = Column(String(30), nullable=True)
    check_in_time = Column(String(5), nullable=True)  # "HH:MM"
    check_out_time = Column(String(5), nullable=True)  # "HH:MM"
    wifi_name = Column(String(100), nullable=True)
    wifi_password = Column(String(100), nullable=True)
    house_rules = Column(Text, nullable=True)  # free-text or JSON
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
