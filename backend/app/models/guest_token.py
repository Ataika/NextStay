from app.db.base import Base
from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func


class GuestToken(Base):
    __tablename__ = "guest_tokens"
    __table_args__ = {"schema": "oltp"}

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(100), unique=True, nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("oltp.bookings.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("oltp.rooms.id"), nullable=False)
    room_number = Column(String(10), nullable=False)
    guest_name = Column(String(100), nullable=False)
    check_in = Column(DateTime(timezone=True), nullable=False)
    check_out = Column(DateTime(timezone=True), nullable=False)
    is_valid = Column(Boolean, nullable=False, default=True)
    access_status = Column(String(20), nullable=False, default="Active")  # Active, Expired, Checked out
    wifi_ssid = Column(String(100), nullable=False, default="NextStay_Guest")
    wifi_password = Column(String(100), nullable=False, default="Welcome2026!")
    contact_info = Column(JSON, nullable=True)  # {phone, whatsapp, email}
    instructions = Column(JSON, nullable=True)  # {accessInfo, activeFrom, activeUntil, doorTroubleshooting}
    house_rules = Column(JSON, nullable=True)  # {quietHours, checkOutTime, smokingPolicy}
    company_code = Column(String(10), ForeignKey("oltp.companies.company_code"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
