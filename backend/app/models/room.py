from sqlalchemy import Column, Integer, String, Float, Text, JSON
from app.db.base import Base


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(10), unique=True, nullable=False, index=True)
    category = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="Available")
    price = Column(Float, nullable=False)
    capacity = Column(Integer, nullable=False, default=2)
    description = Column(Text, nullable=True)
    amenities = Column(JSON, nullable=True)  # Используем JSON вместо ARRAY для совместимости
