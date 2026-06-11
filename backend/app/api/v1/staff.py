import hashlib
import time
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from app.core.limiter import limiter
from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.user import User as UserModel
from app.security.auth import get_current_user, require_roles
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

router = APIRouter(tags=["staff"])
logger = get_logger(__name__)

SHIFT_HOURS: dict[str, float] = {
    "morning": 8.0,
    "afternoon": 8.0,
    "night": 8.0,
    "off": 0.0,
    "day_extended": 12.0,
    "night_extended": 12.0,
}
VALID_ROLES = ["hostess", "cleaner", "manager", "director"]
VALID_SHIFT_TYPES = list(SHIFT_HOURS.keys())

_SHIFT_CODE_SECRET = "nextstay-shift-2026"


def _get_shift_code(bucket_offset: int = 0) -> str:
    bucket = int(time.time()) // 120 + bucket_offset
    digest = hashlib.sha256(f"{_SHIFT_CODE_SECRET}:{bucket}".encode()).hexdigest()
    return str(int(digest[:8], 16) % 900000 + 100000)  # 100000–999999


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ShiftStartRequest(BaseModel):
    code: str


class ShiftCodeResponse(BaseModel):
    code: str
    expires_in: int  # seconds until next rotation


class ShiftStartResponse(BaseModel):
    started_at: str  # ISO timestamp


class StaffCreate(BaseModel):
    name: str
    role: str
    email: str | None = None
    phone: str | None = None
    hire_date: str | None = None
    annual_days_off: int = 20


class StaffUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    email: str | None = None
    phone: str | None = None
    is_active: bool | None = None
    annual_days_off: int | None = None


class StaffMember(BaseModel):
    id: int
    name: str
    role: str
    email: str | None = None
    phone: str | None = None
    hire_date: str | None = None
    is_active: bool
    annual_days_off: int
    hours_this_month: float
    days_off_this_year: int


class ShiftUpsert(BaseModel):
    staff_id: int
    shift_date: str
    shift_type: str


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_STATS_SQL = """
    SELECT
        sm.id,
        sm.name,
        sm.role,
        sm.email,
        sm.phone,
        sm.hire_date,
        sm.is_active,
        sm.annual_days_off,
        COALESCE(SUM(
            CASE WHEN ss.shift_type != 'off'
                 AND DATE_TRUNC('month', ss.shift_date) = DATE_TRUNC('month', CURRENT_DATE)
            THEN ss.hours ELSE 0 END
        ), 0) AS hours_this_month,
        COUNT(
            CASE WHEN ss.shift_type = 'off'
                 AND EXTRACT(year FROM ss.shift_date) = EXTRACT(year FROM CURRENT_DATE)
            THEN 1 END
        ) AS days_off_this_year
    FROM staff_members sm
    LEFT JOIN staff_shifts ss ON ss.staff_id = sm.id
    {where}
    GROUP BY sm.id
    ORDER BY sm.role, sm.name
"""


def _fetch_stats(db: Session, staff_id: int | None = None) -> list:
    where = "WHERE sm.id = :staff_id" if staff_id is not None else ""
    params = {"staff_id": staff_id} if staff_id is not None else {}
    return list(
        db.execute(text(_STATS_SQL.format(where=where)), params).mappings().all()  # noqa: S608
    )


def _to_member(r) -> StaffMember:
    return StaffMember(
        id=r["id"],
        name=r["name"],
        role=r["role"],
        email=r["email"],
        phone=r["phone"],
        hire_date=r["hire_date"].isoformat() if r["hire_date"] else None,
        is_active=r["is_active"],
        annual_days_off=r["annual_days_off"],
        hours_this_month=float(r["hours_this_month"]),
        days_off_this_year=int(r["days_off_this_year"]),
    )


# ---------------------------------------------------------------------------
# Self-service endpoints (matched by login email)
# NOTE: /staff/me and /staff/my-schedule must be defined BEFORE /staff/{staff_id}
# ---------------------------------------------------------------------------


def _staff_id_by_email(db: Session, email: str) -> int | None:
    row = db.execute(
        text("SELECT id FROM staff_members WHERE LOWER(email) = LOWER(:email) AND is_active = TRUE"),
        {"email": email},
    ).fetchone()
    return row.id if row else None


@router.get("/staff/me", response_model=StaffMember)
def get_my_profile(
    db: Annotated[Session, Depends(get_db)],
    user: UserModel = Depends(get_current_user),
):
    rows = _fetch_stats(db)
    for r in rows:
        if (r["email"] or "").lower() == user.email.lower():
            return _to_member(r)
    raise HTTPException(
        status_code=404,
        detail="No staff profile linked to your account. Ask your manager to add your email to the staff list.",
    )


@router.get("/staff/my-schedule")
def get_my_schedule(
    week_start: str,
    db: Annotated[Session, Depends(get_db)],
    user: UserModel = Depends(get_current_user),
):
    try:
        start = date.fromisoformat(week_start)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid week_start (YYYY-MM-DD)") from err

    end = start + timedelta(days=6)
    staff_id = _staff_id_by_email(db, user.email)
    if not staff_id:
        return []

    rows = (
        db.execute(
            text(
                """
            SELECT id, staff_id, shift_date, shift_type, hours, notes
            FROM staff_shifts
            WHERE staff_id = :staff_id
              AND shift_date BETWEEN :start AND :end
            ORDER BY shift_date
            """
            ),
            {"staff_id": staff_id, "start": start, "end": end},
        )
        .mappings()
        .all()
    )

    return [
        {
            "id": r["id"],
            "staff_id": r["staff_id"],
            "shift_date": r["shift_date"].isoformat(),
            "shift_type": r["shift_type"],
            "hours": float(r["hours"]),
            "notes": r["notes"],
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Staff CRUD  (NOTE: /staff/schedule must be defined BEFORE /staff/{staff_id})
# ---------------------------------------------------------------------------


@router.get("/staff", response_model=list[StaffMember])
def list_staff(
    db: Annotated[Session, Depends(get_db)],
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    return [_to_member(r) for r in _fetch_stats(db)]


@router.post("/staff", response_model=StaffMember, status_code=201)
def create_staff_member(
    payload: StaffCreate,
    db: Annotated[Session, Depends(get_db)],
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")

    hire_date = None
    if payload.hire_date:
        try:
            hire_date = date.fromisoformat(payload.hire_date)
        except ValueError as err:
            raise HTTPException(status_code=400, detail="Invalid hire_date (YYYY-MM-DD)") from err

    row = db.execute(
        text(
            """
            INSERT INTO staff_members (name, role, email, phone, hire_date, annual_days_off)
            VALUES (:name, :role, :email, :phone, :hire_date, :annual_days_off)
            RETURNING id
            """
        ),
        {
            "name": payload.name,
            "role": payload.role,
            "email": payload.email,
            "phone": payload.phone,
            "hire_date": hire_date,
            "annual_days_off": payload.annual_days_off,
        },
    ).fetchone()
    db.commit()

    rows = _fetch_stats(db, row.id)
    if not rows:
        raise HTTPException(status_code=500, detail="Failed to retrieve created member")
    return _to_member(rows[0])


# ---------------------------------------------------------------------------
# Schedule endpoints  (must come before /staff/{staff_id})
# ---------------------------------------------------------------------------


@router.get("/staff/schedule")
def get_schedule(
    week_start: str,
    db: Annotated[Session, Depends(get_db)],
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    try:
        start = date.fromisoformat(week_start)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid week_start (YYYY-MM-DD)") from err

    end = start + timedelta(days=6)

    rows = (
        db.execute(
            text(
                """
            SELECT ss.id, ss.staff_id, ss.shift_date, ss.shift_type, ss.hours, ss.notes
            FROM staff_shifts ss
            INNER JOIN staff_members sm ON sm.id = ss.staff_id
            WHERE sm.is_active = TRUE
              AND ss.shift_date BETWEEN :start AND :end
            ORDER BY ss.shift_date, ss.staff_id
            """
            ),
            {"start": start, "end": end},
        )
        .mappings()
        .all()
    )

    return [
        {
            "id": r["id"],
            "staff_id": r["staff_id"],
            "shift_date": r["shift_date"].isoformat(),
            "shift_type": r["shift_type"],
            "hours": float(r["hours"]),
            "notes": r["notes"],
        }
        for r in rows
    ]


@router.put("/staff/schedule")
def upsert_shift(
    payload: ShiftUpsert,
    db: Annotated[Session, Depends(get_db)],
    user: UserModel = Depends(get_current_user),
):
    role = user.role.upper()
    if role not in ("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"):
        raise HTTPException(status_code=403, detail="Insufficient permissions.")
    if payload.shift_type != "off" and role not in ("OWNER", "SYS_ADMIN"):
        raise HTTPException(
            status_code=403,
            detail="Directors and managers may only assign days off, not work shifts.",
        )
    if payload.shift_type not in VALID_SHIFT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid shift_type. Must be one of: {VALID_SHIFT_TYPES}",
        )
    try:
        shift_date = date.fromisoformat(payload.shift_date)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid shift_date (YYYY-MM-DD)") from err

    hours = SHIFT_HOURS[payload.shift_type]

    row = db.execute(
        text(
            """
            INSERT INTO staff_shifts (staff_id, shift_date, shift_type, hours)
            VALUES (:staff_id, :shift_date, :shift_type, :hours)
            ON CONFLICT (staff_id, shift_date) DO UPDATE
                SET shift_type = EXCLUDED.shift_type,
                    hours      = EXCLUDED.hours
            RETURNING id, staff_id, shift_date, shift_type, hours, notes
            """
        ),
        {
            "staff_id": payload.staff_id,
            "shift_date": shift_date,
            "shift_type": payload.shift_type,
            "hours": hours,
        },
    ).fetchone()
    db.commit()

    return {
        "id": row.id,
        "staff_id": row.staff_id,
        "shift_date": row.shift_date.isoformat(),
        "shift_type": row.shift_type,
        "hours": float(row.hours),
        "notes": row.notes,
    }


@router.delete("/staff/schedule/{shift_id}", status_code=204)
def delete_shift(
    shift_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: UserModel = Depends(get_current_user),
):
    role = user.role.upper()
    if role not in ("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"):
        raise HTTPException(status_code=403, detail="Insufficient permissions.")

    if role not in ("OWNER", "SYS_ADMIN"):
        row = db.execute(
            text("SELECT shift_type FROM staff_shifts WHERE id = :id"),
            {"id": shift_id},
        ).fetchone()
        if row and row.shift_type != "off":
            raise HTTPException(
                status_code=403,
                detail="Directors and managers can only clear days off, not work shifts.",
            )

    affected = db.execute(
        text("DELETE FROM staff_shifts WHERE id = :id"),
        {"id": shift_id},
    ).rowcount
    db.commit()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Shift not found")
    return None


# ---------------------------------------------------------------------------
# Staff member update / delete  (after /staff/schedule to avoid route clash)
# ---------------------------------------------------------------------------


@router.patch("/staff/{staff_id}", response_model=StaffMember)
def update_staff_member(
    staff_id: int,
    payload: StaffUpdate,
    db: Annotated[Session, Depends(get_db)],
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    if payload.role is not None and payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")

    affected = db.execute(
        text(
            """
            UPDATE staff_members SET
                name            = COALESCE(:name,            name),
                role            = COALESCE(:role,            role),
                email           = COALESCE(:email,           email),
                phone           = COALESCE(:phone,           phone),
                is_active       = COALESCE(:is_active,       is_active),
                annual_days_off = COALESCE(:annual_days_off, annual_days_off)
            WHERE id = :id
            """
        ),
        {
            "id": staff_id,
            "name": payload.name,
            "role": payload.role,
            "email": payload.email,
            "phone": payload.phone,
            "is_active": payload.is_active,
            "annual_days_off": payload.annual_days_off,
        },
    ).rowcount
    db.commit()

    if affected == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")

    rows = _fetch_stats(db, staff_id)
    if not rows:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return _to_member(rows[0])


@router.get("/staff/shift-code", response_model=ShiftCodeResponse)
def get_shift_code(
    user: UserModel = Depends(get_current_user),
):
    """Return the current 6-digit rotating shift code (rotates every 2 minutes)."""
    _ = user
    code = _get_shift_code()
    expires_in = 120 - (int(time.time()) % 120)
    return ShiftCodeResponse(code=code, expires_in=expires_in)


@router.post("/staff/shift-start", response_model=ShiftStartResponse)
@limiter.limit("10/minute")
def start_shift(
    request: Request,
    payload: ShiftStartRequest,
    user: UserModel = Depends(get_current_user),
):
    """Verify the 6-digit shift code and record the shift start time."""
    _ = user
    current_code = _get_shift_code(0)
    prev_code = _get_shift_code(-1)
    if payload.code.strip() not in (current_code, prev_code):
        logger.warning("Failed shift-start attempt by user %s.", user.email)
        raise HTTPException(status_code=401, detail="Invalid shift code. Please try again.")
    started_at = datetime.now(timezone.utc).isoformat()
    logger.info("Shift started by user %s.", user.email)
    return ShiftStartResponse(started_at=started_at)


@router.post("/staff/heartbeat", status_code=204)
def staff_heartbeat(
    user: UserModel = Depends(get_current_user),
):
    """No-op keepalive so the frontend can confirm the session is still valid."""
    _ = user
    return None


@router.delete("/staff/{staff_id}", status_code=204)
def delete_staff_member(
    staff_id: int,
    db: Annotated[Session, Depends(get_db)],
    _auth=Depends(require_roles("OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER")),
):
    affected = db.execute(
        text("DELETE FROM staff_members WHERE id = :id"),
        {"id": staff_id},
    ).rowcount
    db.commit()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return None
