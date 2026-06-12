from datetime import datetime, timezone

from app.core.task_utils import round_robin_assign
from app.db.session import SessionLocal
from app.models.room import Room as RoomModel
from app.models.task import CleaningTask as TaskModel
from app.models.user import User as UserModel
from app.security.auth import require_roles
from app.security.tenancy import require_hotel_id
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

router = APIRouter(tags=["tasks"])

ALL_ROLES = ("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER", "STAFF")
VALID_PRIORITIES = {"Low", "Medium", "High", "Urgent"}
VALID_STATUSES = {"Pending", "In Progress", "Completed"}


def _get_task_in_hotel(db: Session, task_id: int, hotel_id: int) -> TaskModel:
    task = (
        db.query(TaskModel)
        .join(RoomModel, TaskModel.room_id == RoomModel.id)
        .filter(TaskModel.id == task_id, RoomModel.hotel_id == hotel_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TaskBase(BaseModel):
    roomId: int
    roomNumber: str
    status: str
    priority: str
    notes: str | None = None


class TaskCreate(BaseModel):
    roomId: int
    roomNumber: str
    priority: str = "Medium"
    notes: str | None = None

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        if v not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of: {sorted(VALID_PRIORITIES)}")
        return v


class TaskAssign(BaseModel):
    staffId: int
    staffName: str = Field(..., min_length=1)


class Task(TaskBase):
    id: int
    assignedTo: int | None = None
    assignedToName: str | None = None
    createdAt: str
    completedAt: str | None = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_dates(cls, obj: TaskModel):
        return cls(
            id=obj.id,
            roomId=obj.room_id,
            roomNumber=obj.room_number,
            status=obj.status,
            priority=obj.priority,
            notes=obj.notes,
            assignedTo=obj.assigned_to,
            assignedToName=obj.assigned_to_name,
            createdAt=obj.created_at.isoformat() if obj.created_at else datetime.now().isoformat(),
            completedAt=obj.completed_at.isoformat() if obj.completed_at else None,
        )


@router.get("/tasks", response_model=list[Task])
def get_all_tasks(
    room_id: int | None = Query(None, alias="room_id"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(*ALL_ROLES)),
):
    hotel_id = require_hotel_id(current_user, db)
    query = (
        db.query(TaskModel)
        .join(RoomModel, TaskModel.room_id == RoomModel.id)
        .filter(RoomModel.hotel_id == hotel_id)
    )
    if room_id:
        query = query.filter(TaskModel.room_id == room_id)
    return [Task.from_orm_with_dates(t) for t in query.all()]


@router.get("/tasks/{task_id}", response_model=Task)
def get_task_by_id(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(*ALL_ROLES)),
):
    hotel_id = require_hotel_id(current_user, db)
    task = _get_task_in_hotel(db, task_id, hotel_id)
    return Task.from_orm_with_dates(task)


@router.post("/tasks", response_model=Task, status_code=201)
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(*ALL_ROLES)),
):
    """Create a cleaning task, set room to Cleaning, and auto-assign via round-robin."""
    hotel_id = require_hotel_id(current_user, db)
    room = db.query(RoomModel).filter(RoomModel.id == task.roomId, RoomModel.hotel_id == hotel_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    staff_id, staff_name = round_robin_assign(db)

    db_task = TaskModel(
        room_id=task.roomId,
        room_number=task.roomNumber,
        status="In Progress" if staff_id else "Pending",
        priority=task.priority,
        notes=task.notes,
        assigned_to=staff_id,
        assigned_to_name=staff_name,
    )
    db.add(db_task)
    room.status = "Cleaning"
    db.commit()
    db.refresh(db_task)
    return Task.from_orm_with_dates(db_task)


@router.patch("/tasks/{task_id}/assign", response_model=Task)
def assign_task(
    task_id: int,
    assign_data: TaskAssign,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(*ALL_ROLES)),
):
    hotel_id = require_hotel_id(current_user, db)
    db_task = _get_task_in_hotel(db, task_id, hotel_id)

    db_task.assigned_to = assign_data.staffId
    db_task.assigned_to_name = assign_data.staffName
    db_task.status = "In Progress"
    db.commit()
    db.refresh(db_task)
    return Task.from_orm_with_dates(db_task)


@router.patch("/tasks/{task_id}/complete", response_model=Task)
def complete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(*ALL_ROLES)),
):
    """Complete cleaning task and set room back to Available."""
    hotel_id = require_hotel_id(current_user, db)
    db_task = _get_task_in_hotel(db, task_id, hotel_id)

    if db_task.status == "Completed":
        raise HTTPException(status_code=400, detail="Task is already completed.")

    db_task.status = "Completed"
    db_task.completed_at = datetime.now(timezone.utc)

    room = db.query(RoomModel).filter(RoomModel.id == db_task.room_id).first()
    if room:
        room.status = "Available"

    db.commit()
    db.refresh(db_task)
    return Task.from_orm_with_dates(db_task)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(*ALL_ROLES)),
):
    hotel_id = require_hotel_id(current_user, db)
    db_task = _get_task_in_hotel(db, task_id, hotel_id)
    db.delete(db_task)
    db.commit()
    return None
