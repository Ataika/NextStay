from app.db.base import Base
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    full_name = Column(String(120), nullable=False)
    role = Column(String(20), nullable=False)  # OWNER | STAFF | SYS_ADMIN | DIRECTOR | MANAGER
    password_hash = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    chat_wallpaper = Column(String(500), nullable=True)
    preferred_language = Column(String(10), nullable=False, server_default="'en'", default="en")
    failed_login_attempts = Column(Integer, nullable=False, server_default="0", default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    birth_year = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    # Tenancy scope = canonical hotels.id (== hotel_profile.id via shared-PK 1:1).
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
