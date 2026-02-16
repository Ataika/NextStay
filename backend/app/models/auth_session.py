from app.db.base import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    __table_args__ = {"schema": "oltp"}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("oltp.users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_jti = Column(String(64), nullable=False, unique=True, index=True)
    issued_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
