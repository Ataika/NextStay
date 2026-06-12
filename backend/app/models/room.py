from app.db.base import Base
from sqlalchemy import JSON, Column, Float, ForeignKey, Integer, String, Text, UniqueConstraint


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("hotel_id", "number", name="uq_rooms_hotel_number"),)

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotel_profile.id", ondelete="CASCADE"), nullable=True, index=True)
    number = Column(String(10), nullable=False, index=True)
    category = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="Available")
    price = Column(Float, nullable=False)
    capacity = Column(Integer, nullable=False, default=2)
    description = Column(Text, nullable=True)
    amenities = Column(JSON, nullable=True)  # Use JSON instead of ARRAY for compatibility
    photo_url = Column(String(500), nullable=True)
    area_sqm = Column(Integer, nullable=True)
    bed_type = Column(String(50), nullable=True)
    view_type = Column(String(50), nullable=True)
    floor = Column(Integer, nullable=True)
