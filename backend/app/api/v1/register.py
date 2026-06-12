"""Hotel owner and staff registration."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.utils import ensure_utc as _ensure_utc
from app.api.v1.auth import (
    LoginResponse,
    UserOut,
    create_access_token,
    get_db,
    hash_password,
    normalize_email,
    validate_password_strength,
)
from app.models.auth_session import AuthSession as AuthSessionModel
from app.models.hotel_invite import HotelInvite as HotelInviteModel
from app.models.hotel_profile import HotelProfile as HotelProfileModel
from app.api.v1.staff import ensure_staff_profile
from app.models.user import User as UserModel

router = APIRouter(tags=["auth"])

INVITE_CODE_LENGTH = 8
INVITE_EXPIRY_DAYS = 7
MIN_OWNER_AGE = 18
MIN_STAFF_AGE = 16

Gender = Literal["male", "female", "other", "prefer_not_to_say"]


class RegisterOwnerRequest(BaseModel):
    hotel_name: str = Field(..., min_length=2, max_length=255)
    first_name: str = Field(..., min_length=1, max_length=60)
    last_name: str = Field(..., min_length=1, max_length=60)
    email: EmailStr
    password: str = Field(..., min_length=8)
    birth_year: int = Field(..., ge=1920, le=2010)
    gender: Gender


class VerifyInviteRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=16)


class VerifyInviteResponse(BaseModel):
    valid: bool = True
    email: str
    hotel_name: str


class RegisterStaffRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=16)
    first_name: str = Field(..., min_length=1, max_length=60)
    last_name: str = Field(..., min_length=1, max_length=60)
    email: EmailStr
    password: str = Field(..., min_length=8)
    birth_year: int = Field(..., ge=1920, le=2010)
    gender: Gender


def _current_year() -> int:
    return datetime.now(timezone.utc).year


def _validate_owner_age(birth_year: int) -> None:
    age = _current_year() - birth_year
    if age < MIN_OWNER_AGE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Owner must be at least {MIN_OWNER_AGE} years old.",
        )


def _validate_staff_age(birth_year: int) -> None:
    age = _current_year() - birth_year
    if age < MIN_STAFF_AGE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Staff must be at least {MIN_STAFF_AGE} years old.",
        )


def _normalize_code(code: str) -> str:
    return code.strip().upper().replace("-", "").replace(" ", "")


def _generate_invite_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(INVITE_CODE_LENGTH))


def _issue_login(db: Session, user: UserModel) -> LoginResponse:
    now = datetime.now(timezone.utc)
    user.last_login_at = now
    app_user = UserOut(id=user.id, email=user.email, name=user.full_name)
    token, jti, expires_at, issued_at = create_access_token(app_user, user.role)
    db.add(AuthSessionModel(user_id=user.id, token_jti=jti, issued_at=issued_at, expires_at=expires_at))
    db.commit()
    return LoginResponse(token=token, role=user.role, user=app_user)


def _get_active_invite(db: Session, code: str) -> HotelInviteModel:
    normalized = _normalize_code(code)
    invite = db.query(HotelInviteModel).filter(HotelInviteModel.code == normalized).first()
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid hotel code.")
    if invite.used_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This hotel code has already been used.")
    now = datetime.now(timezone.utc)
    if invite.expires_at and now > _ensure_utc(invite.expires_at):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This hotel code has expired.")
    return invite


@router.post("/auth/register/owner", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register_owner(payload: RegisterOwnerRequest, db: Session = Depends(get_db)):
    _validate_owner_age(payload.birth_year)
    validate_password_strength(payload.password)

    email = normalize_email(payload.email)
    if db.query(UserModel).filter(UserModel.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists.")

    hotel = HotelProfileModel(hotel_name=payload.hotel_name.strip())
    db.add(hotel)
    db.flush()

    full_name = f"{payload.first_name.strip()} {payload.last_name.strip()}"
    user = UserModel(
        email=email,
        full_name=full_name,
        role="OWNER",
        password_hash=hash_password(payload.password),
        is_active=True,
        birth_year=payload.birth_year,
        gender=payload.gender,
        hotel_id=hotel.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue_login(db, user)


@router.post("/auth/register/verify-invite", response_model=VerifyInviteResponse)
def verify_invite(payload: VerifyInviteRequest, db: Session = Depends(get_db)):
    invite = _get_active_invite(db, payload.code)
    hotel = db.query(HotelProfileModel).filter(HotelProfileModel.id == invite.hotel_id).first()
    hotel_name = hotel.hotel_name if hotel else "Hotel"
    return VerifyInviteResponse(email=invite.email, hotel_name=hotel_name)


@router.post("/auth/register/staff", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register_staff(payload: RegisterStaffRequest, db: Session = Depends(get_db)):
    _validate_staff_age(payload.birth_year)
    validate_password_strength(payload.password)

    invite = _get_active_invite(db, payload.code)
    email = normalize_email(payload.email)
    if email != normalize_email(invite.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email does not match the invitation.",
        )
    if db.query(UserModel).filter(UserModel.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists.")

    full_name = f"{payload.first_name.strip()} {payload.last_name.strip()}"
    user = UserModel(
        email=email,
        full_name=full_name,
        role="STAFF",
        password_hash=hash_password(payload.password),
        is_active=True,
        birth_year=payload.birth_year,
        gender=payload.gender,
        hotel_id=invite.hotel_id,
    )
    invite.used_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    ensure_staff_profile(db, name=full_name, email=email, role="cleaner", hotel_id=invite.hotel_id)
    return _issue_login(db, user)


def create_hotel_invite(
    db: Session,
    *,
    hotel_id: int,
    email: str,
    created_by: int | None,
) -> HotelInviteModel:
    """Create a pending staff invite and invalidate previous unused invites for the same email."""
    normalized_email = normalize_email(email)
    now = datetime.now(timezone.utc)

    pending = (
        db.query(HotelInviteModel)
        .filter(
            HotelInviteModel.email == normalized_email,
            HotelInviteModel.hotel_id == hotel_id,
            HotelInviteModel.used_at.is_(None),
        )
        .all()
    )
    for row in pending:
        row.used_at = now

    code = _generate_invite_code()
    while db.query(HotelInviteModel).filter(HotelInviteModel.code == code).first():
        code = _generate_invite_code()

    invite = HotelInviteModel(
        hotel_id=hotel_id,
        email=normalized_email,
        code=code,
        created_by=created_by,
        expires_at=now + timedelta(days=INVITE_EXPIRY_DAYS),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite
