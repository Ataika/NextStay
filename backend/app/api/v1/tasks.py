from datetime import datetime
from typing import List, Optional

from app.db.session import SessionLocal
from app.models.room import Room as RoomModel
from app.models.task import CleaningTask as TaskModel
from app.models.user import User as UserModel
from app.security.auth import get_user_company_scope, require_roles
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter(tags=["tasks"])


# Dependency to get the DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Pydantic models
class TaskBase(BaseModel):
    roomId: int
    roomNumber: str
    status: str
    priority: str
    notes: Optional[str] = None


class TaskCreate(BaseModel):
    roomId: int
    roomNumber: str
    priority: str = "Medium"
    notes: Optional[str] = None


class TaskAssign(BaseModel):
    staffId: int
    staffName: str


class Task(TaskBase):
    id: int
    assignedTo: Optional[int] = None
    assignedToName: Optional[str] = None
    createdAt: str
    completedAt: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_dates(cls, obj: TaskModel):
        """Converts ORM object to Pydantic model with correct date format"""
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


# CRUD operations
@router.get("/tasks", response_model=List[Task])
def get_all_tasks(
    room_id: Optional[int] = Query(None, alias="room_id"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles("OWNER", "STAFF")),
):
    """Get all tasks or tasks by room"""
    company_code = get_user_company_scope(current_user)
    query = db.query(TaskModel).filter(TaskModel.company_code == company_code)
    if room_id:
        query = query.filter(TaskModel.room_id == room_id)
    tasks = query.all()
    return [Task.from_orm_with_dates(task) for task in tasks]


@router.get("/tasks/{task_id}", response_model=Task)
def get_task_by_id(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles("OWNER", "STAFF")),
):
    """Get task by ID"""
    company_code = get_user_company_scope(current_user)
    task = db.query(TaskModel).filter(TaskModel.id == task_id, TaskModel.company_code == company_code).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return Task.from_orm_with_dates(task)


@router.post("/tasks", response_model=Task, status_code=201)
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles("OWNER", "STAFF")),
):
    """Create a new task and automatically change room status to Cleaning"""
    company_code = get_user_company_scope(current_user)
    # Check if room exists
    room = db.query(RoomModel).filter(RoomModel.id == task.roomId, RoomModel.company_code == company_code).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Create task
    db_task = TaskModel(
        room_id=task.roomId,
        room_number=task.roomNumber,
        status="Pending",
        priority=task.priority,
        notes=task.notes,
        company_code=company_code,
    )
    db.add(db_task)

    # Automatically change room status to "Cleaning"
    room.status = "Cleaning"

    db.commit()
    db.refresh(db_task)
    return Task.from_orm_with_dates(db_task)


@router.patch("/tasks/{task_id}/assign", response_model=Task)
def assign_task(
    task_id: int,
    assign_data: TaskAssign,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles("OWNER", "STAFF")),
):
    """Assign task to staff.

    Only users with role STAFF from the same company can be assigned.
    """
    company_code = get_user_company_scope(current_user)

    # Ensure task exists in current company
    db_task = (
        db.query(TaskModel)
        .filter(TaskModel.id == task_id, TaskModel.company_code == company_code)
        .first()
    )
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Validate that staff user exists, is active, has STAFF role and belongs to same company
    staff_user = (
        db.query(UserModel)
        .filter(
            UserModel.id == assign_data.staffId,
            UserModel.is_active.is_(True),
            UserModel.role == "STAFF",
            UserModel.company_code == company_code,
        )
        .first()
    )
    if not staff_user:
        raise HTTPException(
            status_code=400,
            detail="Staff user not found in this company.",
        )

    # Trust data from DB, not from request body
    db_task.assigned_to = staff_user.id
    db_task.assigned_to_name = staff_user.full_name
    db_task.status = "In Progress"

    db.commit()
    db.refresh(db_task)
    return Task.from_orm_with_dates(db_task)


@router.patch("/tasks/{task_id}/complete", response_model=Task)
def complete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles("OWNER", "STAFF")),
):
    """Complete cleaning task and automatically change room status to Available"""
    company_code = get_user_company_scope(current_user)
    db_task = db.query(TaskModel).filter(TaskModel.id == task_id, TaskModel.company_code == company_code).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    db_task.status = "Completed"
    db_task.completed_at = datetime.now()

    # Get room and change it to Available after cleaning is completed
    room = db.query(RoomModel).filter(RoomModel.id == db_task.room_id, RoomModel.company_code == company_code).first()
    if room:
        # After cleaning is completed, room always goes to Available status
        room.status = "Available"

    db.commit()
    db.refresh(db_task)
    return Task.from_orm_with_dates(db_task)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles("OWNER", "STAFF")),
):
    """Delete cleaning task"""
    company_code = get_user_company_scope(current_user)
    db_task = db.query(TaskModel).filter(TaskModel.id == task_id, TaskModel.company_code == company_code).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(db_task)
    db.commit()
    return None
