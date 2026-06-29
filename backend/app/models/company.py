from app.db.base import Base
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func


class Company(Base):
    """A company groups one or more hotels.

    This is a grouping layer *over* the canonical ``hotel_id`` tenancy — hotels stay
    the operational isolation unit; a company simply owns several of them.
    """

    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
