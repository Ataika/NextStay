from datetime import datetime, timedelta, timezone
from typing import Annotated

from app.db.session import SessionLocal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

router = APIRouter(tags=["holds"])

HOLD_MINUTES = 10


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class HoldCreate(BaseModel):
    room_id: int
    check_in: str
    check_out: str
    session_id: str


class HoldResponse(BaseModel):
    id: int
    room_id: int
    check_in: str
    check_out: str
    session_id: str
    expires_at: str


def _purge_expired(db: Session) -> None:
    now = datetime.now(timezone.utc)
    db.execute(text("DELETE FROM room_holds WHERE expires_at <= :now"), {"now": now})


def _has_active_hold(db: Session, room_id: int, check_in: datetime, check_out: datetime, exclude_session: str) -> bool:
    now = datetime.now(timezone.utc)
    row = db.execute(
        text(
            """
            SELECT id FROM room_holds
            WHERE room_id = :room_id
              AND session_id != :session_id
              AND expires_at > :now
              AND check_in < :check_out
              AND check_out > :check_in
            LIMIT 1
            """
        ),
        {
            "room_id": room_id,
            "session_id": exclude_session,
            "now": now,
            "check_in": check_in,
            "check_out": check_out,
        },
    ).fetchone()
    return row is not None


@router.post("/holds", response_model=HoldResponse, status_code=201)
def create_hold(payload: HoldCreate, db: Annotated[Session, Depends(get_db)]):
    _purge_expired(db)

    try:
        check_in = datetime.fromisoformat(payload.check_in.replace("Z", "+00:00"))
        check_out = datetime.fromisoformat(payload.check_out.replace("Z", "+00:00"))
    except (ValueError, AttributeError) as err:
        raise HTTPException(status_code=400, detail="Invalid date format") from err

    if _has_active_hold(db, payload.room_id, check_in, check_out, payload.session_id):
        raise HTTPException(status_code=409, detail="Room is temporarily held by another user")

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=HOLD_MINUTES)

    result = db.execute(
        text(
            """
            INSERT INTO room_holds (room_id, check_in, check_out, session_id, expires_at)
            VALUES (:room_id, :check_in, :check_out, :session_id, :expires_at)
            RETURNING id, room_id, check_in, check_out, session_id, expires_at
            """
        ),
        {
            "room_id": payload.room_id,
            "check_in": check_in,
            "check_out": check_out,
            "session_id": payload.session_id,
            "expires_at": expires_at,
        },
    ).fetchone()
    db.commit()

    return HoldResponse(
        id=result.id,
        room_id=result.room_id,
        check_in=result.check_in.isoformat(),
        check_out=result.check_out.isoformat(),
        session_id=result.session_id,
        expires_at=result.expires_at.isoformat(),
    )


@router.delete("/holds/{hold_id}", status_code=204)
def release_hold(hold_id: int, session_id: str, db: Annotated[Session, Depends(get_db)]):
    rows = db.execute(
        text("DELETE FROM room_holds WHERE id = :id AND session_id = :session_id"),
        {"id": hold_id, "session_id": session_id},
    ).rowcount
    db.commit()
    if rows == 0:
        raise HTTPException(status_code=404, detail="Hold not found or already released")
    return None
