from app.db.base import Base
from sqlalchemy import (
    JSON,
    Column,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("hotel_id", "number", name="uq_rooms_hotel_number"),)

    id = Column(Integer, primary_key=True, index=True)
    # Canonical hotel entity is `hotels` (sync registry + identity). hotel_profile is a 1:1
    # descriptive extension (hotel_profile.hotel_id -> hotels.id). See docs/MERGE_DEV_NOTES.md.
    # nullable during migration (existing rooms backfilled to a hotel in the Postgres migration);
    # note: UniqueConstraint(hotel_id, number) does not constrain rows where hotel_id IS NULL.
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=True, index=True)
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
