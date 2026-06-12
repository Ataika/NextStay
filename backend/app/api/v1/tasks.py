from datetime import datetime, timezone

from app.core.task_checklist import all_items_checked, build_checklist, ensure_checklist, toggle_checklist_item
from app.core.task_utils import round_robin_assign
from app.db.session import SessionLocal
from app.models.room import Room as RoomModel
from app.models.task import CleaningTask as TaskModel
from app.models.user import User as UserModel
from app.security.auth import require_roles
from app.security.tenancy import require_hotel_id
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.orm import Session

router = APIRouter(tags=["tasks"])

ALL_ROLES = ("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER", "STAFF")
VALID_PRIORITIES = {"Low", "Medium", "High", "Urgent"}
VALID_STATUSES = {"Pending", "In Progress", "Completed"}
VALID_TASK_TYPES = {"cleaning", "maintenance", "inventory", "guest_request"}


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


class ChecklistItem(BaseModel):
    id: str
    label: str
    checked: bool = False


class TaskBase(BaseModel):
    roomId: int
    roomNumber: str
    status: str
    priority: str
    taskType: str = "cleaning"
    notes: str | None = None
    dueAt: str | None = None
    checklist: list[ChecklistItem] = []


class TaskCreate(BaseModel):
    roomId: int
    roomNumber: str
    priority: str = "Medium"
    taskType: str = "cleaning"
    notes: str | None = None
    dueAt: str | None = None
    staffId: int | None = None
    staffName: str | None = None
    checklistItems: list[str] | None = None

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        if v not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of: {sorted(VALID_PRIORITIES)}")
        return v

    @field_validator("taskType")
    @classmethod
    def validate_task_type(cls, v: str) -> str:
        if v not in VALID_TASK_TYPES:
            raise ValueError(f"taskType must be one of: {sorted(VALID_TASK_TYPES)}")
        return v


class TaskAssign(BaseModel):
    staffId: int
    staffName: str = Field(..., min_length=1)


class ChecklistItemUpdate(BaseModel):
    itemId: str
    checked: bool


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
        raw_checklist = obj.checklist if isinstance(obj.checklist, list) else build_checklist(None)
        checklist = [
            ChecklistItem(
                id=str(item.get("id", index)),
                label=str(item.get("label", "")),
                checked=bool(item.get("checked")),
            )
            for index, item in enumerate(raw_checklist)
        ]
        return cls(
            id=obj.id,
            roomId=obj.room_id,
            roomNumber=obj.room_number,
            status=obj.status,
            priority=obj.priority,
            taskType=obj.task_type or "cleaning",
            notes=obj.notes,
            dueAt=obj.due_at.isoformat() if obj.due_at else None,
            checklist=checklist,
            assignedTo=obj.assigned_to,
            assignedToName=obj.assigned_to_name,
            createdAt=obj.created_at.isoformat() if obj.created_at else datetime.now().isoformat(),
            completedAt=obj.completed_at.isoformat() if obj.completed_at else None,
        )


def _assert_staff_in_hotel(db: Session, staff_id: int, hotel_id: int) -> None:
    row = (
        db.execute(
            text(
                """
                SELECT id FROM staff_members
                WHERE id = :staff_id AND hotel_id = :hotel_id AND is_active = TRUE
                """
            ),
            {"staff_id": staff_id, "hotel_id": hotel_id},
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Staff member not found")


def _staff_member_id_for_user(db: Session, user: UserModel) -> int | None:
    row = (
        db.execute(
            text(
                """
                SELECT id FROM staff_members
                WHERE LOWER(email) = LOWER(:email) AND is_active = TRUE
                LIMIT 1
                """
            ),
            {"email": user.email},
        )
        .first()
    )
    return int(row[0]) if row else None


def _assert_staff_can_work_task(db: Session, db_task: TaskModel, user: UserModel) -> None:
    if user.role.upper() != "STAFF":
        return
    staff_id = _staff_member_id_for_user(db, user)
    if db_task.assigned_to is not None and staff_id is not None and db_task.assigned_to != staff_id:
        raise HTTPException(status_code=403, detail="Task is assigned to another staff member.")


def _parse_due_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid dueAt format. Use ISO 8601.") from err


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

    due_at = _parse_due_at(task.dueAt)
    now = datetime.now(timezone.utc)
    is_planned = due_at is not None and due_at > now

    if task.staffId is not None and task.staffName:
        _assert_staff_in_hotel(db, task.staffId, hotel_id)
        staff_id, staff_name = task.staffId, task.staffName.strip()
    else:
        staff_id, staff_name = round_robin_assign(db, hotel_id)

    if is_planned:
        status = "Pending"
    elif staff_id:
        status = "In Progress"
    else:
        status = "Pending"

    db_task = TaskModel(
        room_id=task.roomId,
        room_number=task.roomNumber,
        status=status,
        priority=task.priority,
        task_type=task.taskType,
        notes=task.notes,
        due_at=due_at,
        checklist=build_checklist(task.checklistItems),
        assigned_to=staff_id,
        assigned_to_name=staff_name,
    )
    db.add(db_task)
    if task.taskType == "cleaning" and not is_planned:
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
    _assert_staff_in_hotel(db, assign_data.staffId, hotel_id)

    db_task.assigned_to = assign_data.staffId
    db_task.assigned_to_name = assign_data.staffName
    db_task.status = "In Progress"
    db.commit()
    db.refresh(db_task)
    return Task.from_orm_with_dates(db_task)


@router.patch("/tasks/{task_id}/checklist", response_model=Task)
def update_task_checklist_item(
    task_id: int,
    payload: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(*ALL_ROLES)),
):
    hotel_id = require_hotel_id(current_user, db)
    db_task = _get_task_in_hotel(db, task_id, hotel_id)

    if db_task.status == "Completed":
        raise HTTPException(status_code=400, detail="Cannot update a completed task.")

    _assert_staff_can_work_task(db, db_task, current_user)
    if current_user.role.upper() == "STAFF" and db_task.status == "Pending":
        db_task.status = "In Progress"

    db_task.checklist = ensure_checklist(db_task.checklist)
    try:
        db_task.checklist = toggle_checklist_item(db_task.checklist, payload.itemId, payload.checked)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err

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

    _assert_staff_can_work_task(db, db_task, current_user)
    if current_user.role.upper() == "STAFF":
        db_task.checklist = ensure_checklist(db_task.checklist)
        if not all_items_checked(db_task.checklist):
            raise HTTPException(
                status_code=400,
                detail="Complete all checklist items before marking the task as done.",
            )

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
