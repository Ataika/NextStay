import hashlib
import hmac
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from app.core.config import (
    AUTH_JWT_SECRET,
    AUTH_TOKEN_EXPIRES_MINUTES,
    OTP_EXP_MINUTES,
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_SECONDS,
    OTP_SECRET,
)
from app.core.logging import get_logger
from app.core.utils import ensure_utc as _ensure_utc
from app.db.session import SessionLocal
from app.models.auth_session import AuthSession as AuthSessionModel
from app.models.email_otp import EmailOtp as EmailOtpModel
from app.models.user import User as UserModel
from app.security.auth import get_current_user
from app.services.email_service import send_otp_email
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

router = APIRouter(tags=["auth"])
logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class RequestOtpRequest(BaseModel):
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str


class UserOut(BaseModel):
    id: int
    email: str
    name: str


class LoginResponse(BaseModel):
    token: str
    role: str
    user: UserOut


class RequestOtpResponse(BaseModel):
    message: str
    retryAfterSeconds: int | None = None


# ---------------------------------------------------------------------------
# DB helper
# ---------------------------------------------------------------------------


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_chat_wallpaper(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if cleaned.startswith("url(") and cleaned.endswith(")"):
        cleaned = cleaned[4:-1].strip().strip('"').strip("'")
    if cleaned.startswith("image:"):
        cleaned = cleaned.removeprefix("image:").strip()
    if cleaned.startswith(("http://", "https://")):
        return f"image:{cleaned}"
    return cleaned


def normalize_preferred_language(value: str | None) -> str:
    cleaned = (value or "").strip().lower()
    return cleaned if cleaned in {"en", "it"} else "en"


# ---------------------------------------------------------------------------
# Password hashing (PBKDF2-HMAC-SHA256, stdlib only)
# ---------------------------------------------------------------------------

_PBKDF2_ITERS = 260_000


def hash_password(password: str) -> str:
    salt = os.urandom(32)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERS)
    return salt.hex() + ":" + dk.hex()


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, dk_hex = stored.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERS)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:  # noqa: BLE001
        return False


def validate_password_strength(password: str) -> None:
    """Raise HTTPException if password doesn't meet complexity requirements."""
    errors = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not re.search(r"[A-Z]", password):
        errors.append("at least one uppercase letter")
    if not re.search(r"[0-9]", password):
        errors.append("at least one digit")
    if not re.search(r"[^A-Za-z0-9]", password):
        errors.append("at least one special character")
    if errors:
        raise HTTPException(
            status_code=400,
            detail=f"Password must contain: {', '.join(errors)}.",
        )


# ---------------------------------------------------------------------------
# Account lockout helpers
# ---------------------------------------------------------------------------


def _check_lockout(user: UserModel) -> None:
    if user.locked_until:
        now = datetime.now(timezone.utc)
        locked_until = _ensure_utc(user.locked_until)
        if locked_until > now:
            remaining = int((locked_until - now).total_seconds() / 60) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Account locked due to too many failed attempts. Try again in {remaining} minute(s).",
            )
        # Lockout expired — clear it
        user.locked_until = None
        user.failed_login_attempts = 0


def _record_failed_attempt(user: UserModel, db: Session) -> None:
    user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
    if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
        user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        logger.warning("Account %s locked after %d failed attempts.", user.email, MAX_FAILED_ATTEMPTS)
    db.commit()


def _clear_failed_attempts(user: UserModel, db: Session) -> None:
    if user.failed_login_attempts or user.locked_until:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()


# ---------------------------------------------------------------------------
# OTP helpers
# ---------------------------------------------------------------------------


def hash_otp(email: str, code: str) -> str:
    value = f"{normalize_email(email)}:{code}:{OTP_SECRET}"
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def create_access_token(user: UserOut, role: str) -> tuple[str, str, datetime, datetime]:
    now = datetime.now(timezone.utc)
    jti = uuid.uuid4().hex
    expires_at = now + timedelta(minutes=AUTH_TOKEN_EXPIRES_MINUTES)
    payload = {
        "sub": str(user.id),
        "role": role,
        "user_id": user.id,
        "jti": jti,
        "exp": expires_at,
        "iat": now,
    }
    token = jwt.encode(payload, AUTH_JWT_SECRET, algorithm="HS256")
    return token, jti, expires_at, now


def _send_otp_for_email(email: str, db: Session) -> RequestOtpResponse:
    """Shared logic for request-otp and forgot-password."""
    now = datetime.now(timezone.utc)
    latest_otp = (
        db.query(EmailOtpModel).filter(EmailOtpModel.email == email).order_by(EmailOtpModel.created_at.desc()).first()
    )
    if latest_otp and latest_otp.created_at:
        seconds_since = int((now - latest_otp.created_at).total_seconds())
        if seconds_since < OTP_RESEND_SECONDS:
            retry_after = OTP_RESEND_SECONDS - seconds_since
            return RequestOtpResponse(
                message="OTP recently sent. Please wait before requesting another code.",
                retryAfterSeconds=retry_after,
            )
    otp_code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        EmailOtpModel(
            email=email,
            code_hash=hash_otp(email, otp_code),
            expires_at=now + timedelta(minutes=OTP_EXP_MINUTES),
            attempts=0,
            used=False,
        )
    )
    db.commit()
    if not send_otp_email(email, otp_code):
        logger.error("Failed to send OTP email to %s", email)
        raise HTTPException(status_code=500, detail="Failed to send OTP email. Check email configuration.")
    return RequestOtpResponse(message="OTP sent successfully.")


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------


@router.post("/auth/request-otp", response_model=RequestOtpResponse)
def request_otp(payload: RequestOtpRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    user = db.query(UserModel).filter(UserModel.email == email, UserModel.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User is not registered or inactive.")
    return _send_otp_for_email(email, db)


@router.post("/auth/verify-otp", response_model=LoginResponse)
def verify_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    code = payload.code.strip()
    if not code.isdigit() or len(code) != 6:
        raise HTTPException(status_code=400, detail="OTP code must be a 6-digit number.")

    otp_row = (
        db.query(EmailOtpModel)
        .filter(EmailOtpModel.email == email, EmailOtpModel.used.is_(False))
        .order_by(EmailOtpModel.created_at.desc())
        .first()
    )
    if not otp_row:
        raise HTTPException(status_code=404, detail="No active OTP found. Request a new code.")

    user_row = db.query(UserModel).filter(UserModel.email == email, UserModel.is_active.is_(True)).first()
    if not user_row:
        otp_row.used = True
        db.commit()
        raise HTTPException(status_code=404, detail="User is not registered or inactive.")

    now = datetime.now(timezone.utc)
    if otp_row.expires_at and now > _ensure_utc(otp_row.expires_at):
        otp_row.used = True
        db.commit()
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new code.")

    if otp_row.attempts >= OTP_MAX_ATTEMPTS:
        otp_row.used = True
        db.commit()
        raise HTTPException(status_code=429, detail="Too many invalid attempts. Request a new OTP.")

    if hash_otp(email, code) != otp_row.code_hash:
        otp_row.attempts += 1
        if otp_row.attempts >= OTP_MAX_ATTEMPTS:
            otp_row.used = True
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid OTP code.")

    otp_row.used = True
    user_row.last_login_at = now
    _clear_failed_attempts(user_row, db)
    app_user = UserOut(id=user_row.id, email=user_row.email, name=user_row.full_name)
    token, jti, expires_at, issued_at = create_access_token(app_user, user_row.role)
    db.add(AuthSessionModel(user_id=user_row.id, token_jti=jti, issued_at=issued_at, expires_at=expires_at))
    db.commit()
    logger.info("User %s logged in via OTP.", email)
    return LoginResponse(token=token, role=user_row.role, user=app_user)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/auth/login", response_model=LoginResponse)
def login_with_password(payload: LoginRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    user = db.query(UserModel).filter(UserModel.email == email, UserModel.is_active.is_(True)).first()

    # Always check lockout before revealing whether user exists (prevents enumeration)
    if user:
        _check_lockout(user)

    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        if user:
            _record_failed_attempt(user, db)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    _clear_failed_attempts(user, db)
    now = datetime.now(timezone.utc)
    user.last_login_at = now
    app_user = UserOut(id=user.id, email=user.email, name=user.full_name)
    token, jti, expires_at, issued_at = create_access_token(app_user, user.role)
    db.add(AuthSessionModel(user_id=user.id, token_jti=jti, issued_at=issued_at, expires_at=expires_at))
    db.commit()
    logger.info("User %s logged in via password.", email)
    return LoginResponse(token=token, role=user.role, user=app_user)


# ---------------------------------------------------------------------------
# Forgot / reset password
# ---------------------------------------------------------------------------


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


@router.post("/auth/forgot-password", response_model=RequestOtpResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Send a password-reset OTP. Always returns 200 to avoid user enumeration."""
    email = normalize_email(payload.email)
    user = db.query(UserModel).filter(UserModel.email == email, UserModel.is_active.is_(True)).first()
    if not user:
        # Don't reveal whether the email exists
        return RequestOtpResponse(message="If that email is registered you will receive a reset code.")
    return _send_otp_for_email(email, db)


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    newPassword: str


@router.post("/auth/reset-password", status_code=204)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    code = payload.code.strip()

    validate_password_strength(payload.newPassword)

    otp_row = (
        db.query(EmailOtpModel)
        .filter(EmailOtpModel.email == email, EmailOtpModel.used.is_(False))
        .order_by(EmailOtpModel.created_at.desc())
        .first()
    )
    if not otp_row:
        raise HTTPException(status_code=400, detail="No active reset code found. Request a new one.")

    now = datetime.now(timezone.utc)
    if otp_row.expires_at and now > _ensure_utc(otp_row.expires_at):
        otp_row.used = True
        db.commit()
        raise HTTPException(status_code=400, detail="Reset code has expired.")

    if otp_row.attempts >= OTP_MAX_ATTEMPTS:
        otp_row.used = True
        db.commit()
        raise HTTPException(status_code=429, detail="Too many invalid attempts. Request a new code.")

    if hash_otp(email, code) != otp_row.code_hash:
        otp_row.attempts += 1
        if otp_row.attempts >= OTP_MAX_ATTEMPTS:
            otp_row.used = True
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid reset code.")

    user = db.query(UserModel).filter(UserModel.email == email, UserModel.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    otp_row.used = True
    user.password_hash = hash_password(payload.newPassword)
    _clear_failed_attempts(user, db)
    # Revoke all existing sessions so old tokens are invalidated
    db.query(AuthSessionModel).filter(
        AuthSessionModel.user_id == user.id,
        AuthSessionModel.revoked_at.is_(None),
    ).update({"revoked_at": now})
    db.commit()
    logger.info("Password reset for user %s.", email)


# ---------------------------------------------------------------------------
# Logout / profile / preferences
# ---------------------------------------------------------------------------


@router.post("/auth/logout")
def logout(current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    db.query(AuthSessionModel).filter(
        AuthSessionModel.user_id == current_user.id,
        AuthSessionModel.revoked_at.is_(None),
    ).update({"revoked_at": now})
    db.commit()
    return {"message": "Logged out successfully"}


class UpdateProfileRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


class UpdateProfileResponse(BaseModel):
    name: str
    email: str


@router.patch("/auth/me", response_model=UpdateProfileResponse)
def update_profile(
    payload: UpdateProfileRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.full_name = payload.name.strip()
    db.commit()
    return UpdateProfileResponse(name=current_user.full_name, email=current_user.email)


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str


@router.post("/auth/change-password", status_code=204)
def change_password(
    payload: ChangePasswordRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_password_strength(payload.newPassword)
    if not current_user.password_hash or not verify_password(payload.currentPassword, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    current_user.password_hash = hash_password(payload.newPassword)
    db.commit()


class UserPreferencesUpdate(BaseModel):
    chat_wallpaper: str | None = None
    preferred_language: str | None = None


class UserPreferencesOut(BaseModel):
    chat_wallpaper: str | None
    preferred_language: str


@router.patch("/auth/me/preferences", response_model=UserPreferencesOut)
def update_preferences(
    payload: UserPreferencesUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if "chat_wallpaper" in payload.model_fields_set:
        current_user.chat_wallpaper = normalize_chat_wallpaper(payload.chat_wallpaper)
    if "preferred_language" in payload.model_fields_set:
        current_user.preferred_language = normalize_preferred_language(payload.preferred_language)
    db.commit()
    return UserPreferencesOut(
        chat_wallpaper=current_user.chat_wallpaper,
        preferred_language=normalize_preferred_language(current_user.preferred_language),
    )


@router.get("/auth/me/preferences", response_model=UserPreferencesOut)
def get_preferences(current_user: UserModel = Depends(get_current_user)):
    return UserPreferencesOut(
        chat_wallpaper=current_user.chat_wallpaper,
        preferred_language=normalize_preferred_language(current_user.preferred_language),
    )
