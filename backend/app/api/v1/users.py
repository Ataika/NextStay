"""Hotel team user management (owner + manager)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.v1.auth import get_db, hash_password, normalize_email, validate_password_strength
from app.api.v1.register import create_hotel_invite
from app.api.v1.staff import ensure_staff_profile
from app.models.hotel_profile import HotelProfile as HotelProfileModel
from app.models.user import User as UserModel
from app.security.auth import get_current_user
from app.security.permissions import (
    ASSIGNABLE_USER_ROLES,
    assert_can_change_role,
    assert_can_delete_user,
    assert_can_invite_role,
    can_manage_hotel_operations,
    normalize_role,
)
from app.security.tenancy import assert_user_in_hotel, require_hotel_id
from app.services.email_service import send_hotel_invite_email

router = APIRouter(tags=["users"])


class TeamUserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool


class TeamUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=120)
    role: str = "STAFF"
    password: str = Field(..., min_length=8)


class TeamUserUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=120)
    role: str | None = None
    is_active: bool | None = None


class TeamUserInviteRequest(BaseModel):
    email: EmailStr


class TeamUserInviteResponse(BaseModel):
    message: str


def _to_team_user(user: UserModel) -> TeamUserOut:
    return TeamUserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
    )


def _require_team_manager(user: UserModel = Depends(get_current_user)) -> UserModel:
    if not can_manage_hotel_operations(user.role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions.")
    return user


def _get_team_user(db: Session, user_id: int, hotel_id: int) -> UserModel:
    target = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    assert_user_in_hotel(target, hotel_id)
    return target


@router.get("/users", response_model=list[TeamUserOut])
def list_team_users(
    db: Session = Depends(get_db),
    actor: UserModel = Depends(_require_team_manager),
):
    hotel_id = require_hotel_id(actor, db)
    users = (
        db.query(UserModel)
        .filter(
            UserModel.hotel_id == hotel_id,
            UserModel.role.in_(tuple(ASSIGNABLE_USER_ROLES | {"OWNER", "MANAGER"})),
        )
        .order_by(UserModel.role.asc(), UserModel.full_name.asc())
        .all()
    )
    return [_to_team_user(u) for u in users]


@router.post("/users/invite", response_model=TeamUserInviteResponse, status_code=status.HTTP_201_CREATED)
def invite_team_user(
    payload: TeamUserInviteRequest,
    db: Session = Depends(get_db),
    actor: UserModel = Depends(_require_team_manager),
):
    hotel_id = require_hotel_id(actor, db)
    email = normalize_email(payload.email)
    if db.query(UserModel).filter(UserModel.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists.")

    hotel = db.query(HotelProfileModel).filter(HotelProfileModel.id == hotel_id).first()
    hotel_name = hotel.hotel_name if hotel else "NextStay Hotel"

    invite = create_hotel_invite(db, hotel_id=hotel_id, email=email, created_by=actor.id)
    if not send_hotel_invite_email(email, invite.code, hotel_name):
        raise HTTPException(status_code=500, detail="Failed to send invitation email. Check email configuration.")

    return TeamUserInviteResponse(message="Confirmation code sent to email.")


@router.post("/users", response_model=TeamUserOut, status_code=status.HTTP_201_CREATED)
def create_team_user(
    payload: TeamUserCreate,
    db: Session = Depends(get_db),
    actor: UserModel = Depends(_require_team_manager),
):
    hotel_id = require_hotel_id(actor, db)
    assert_can_invite_role(actor.role, payload.role)
    validate_password_strength(payload.password)

    email = normalize_email(payload.email)
    if db.query(UserModel).filter(UserModel.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists.")

    user = UserModel(
        email=email,
        full_name=payload.full_name.strip(),
        role=normalize_role(payload.role),
        password_hash=hash_password(payload.password),
        is_active=True,
        hotel_id=hotel_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    if normalize_role(payload.role) == "STAFF":
        ensure_staff_profile(
            db,
            name=user.full_name,
            email=user.email,
            role="cleaner",
            hotel_id=hotel_id,
        )
    return _to_team_user(user)


@router.patch("/users/{user_id}", response_model=TeamUserOut)
def update_team_user(
    user_id: int,
    payload: TeamUserUpdate,
    db: Session = Depends(get_db),
    actor: UserModel = Depends(_require_team_manager),
):
    hotel_id = require_hotel_id(actor, db)
    target = _get_team_user(db, user_id, hotel_id)

    if payload.role is not None:
        assert_can_change_role(actor.role, target.role, payload.role)
        target.role = normalize_role(payload.role)

    if payload.full_name is not None:
        target.full_name = payload.full_name.strip()

    if payload.is_active is not None:
        if payload.is_active is False and actor.id == target.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate your own account.")
        if payload.is_active is False and normalize_role(actor.role) != "OWNER" and normalize_role(target.role) != "STAFF":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Managers can only deactivate staff accounts.",
            )
        target.is_active = payload.is_active

    db.commit()
    db.refresh(target)
    return _to_team_user(target)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team_user(
    user_id: int,
    db: Session = Depends(get_db),
    actor: UserModel = Depends(_require_team_manager),
):
    hotel_id = require_hotel_id(actor, db)
    target = _get_team_user(db, user_id, hotel_id)

    assert_can_delete_user(actor.role, target.role, actor_id=actor.id, target_id=target.id)
    db.delete(target)
    db.commit()
