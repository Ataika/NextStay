from app.db.base import Base
from sqlalchemy import JSON, Column, Float, ForeignKey, Integer, String, Text


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = {"schema": "oltp"}

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(10), unique=True, nullable=False, index=True)
    category = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="Available")
    price = Column(Float, nullable=False)
    capacity = Column(Integer, nullable=False, default=2)
    description = Column(Text, nullable=True)
    amenities = Column(JSON, nullable=True)  # Use JSON instead of ARRAY for compatibility
    company_code = Column(String(10), ForeignKey("oltp.companies.company_code"), nullable=True, index=True)
