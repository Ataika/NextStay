from app.db.base import Base
from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func


class CleaningTask(Base):
    __tablename__ = "cleaning_tasks"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    room_number = Column(String(10), nullable=False)
    status = Column(String(20), nullable=False, default="Pending")
    priority = Column(String(20), nullable=False, default="Medium")
    assigned_to = Column(Integer, nullable=True)  # staff ID
    assigned_to_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    task_type = Column(String(30), nullable=False, default="cleaning")
    due_at = Column(DateTime(timezone=True), nullable=True)
    checklist = Column(JSON, nullable=True)
