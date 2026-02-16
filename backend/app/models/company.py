from app.db.base import Base
from sqlalchemy import Column, DateTime, String
from sqlalchemy.sql import func


class Company(Base):
    __tablename__ = "companies"
    __table_args__ = {"schema": "oltp"}

    company_code = Column(String, primary_key=True)
    company_name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
