import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from app.core.config import (
    ALLOW_OWNER_SELF_REGISTER,
    AUTH_JWT_SECRET,
    AUTH_TOKEN_EXPIRES_MINUTES,
    DEV_BYPASS_EMAILS,
    DEV_BYPASS_PASSWORD,
    OTP_EXP_MINUTES,
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_SECONDS,
    OTP_SECRET,
)
from app.db.session import SessionLocal
from app.models.auth_session import AuthSession as AuthSessionModel
from app.models.email_otp import EmailOtp as EmailOtpModel
from app.models.user import User as UserModel
from app.security.auth import get_current_user
from app.services.email_service import send_otp_email
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

router = APIRouter(tags=["auth"])
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


class RequestOtpRequest(BaseModel):
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str


class PasswordLoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    fullName: str
    password: str
    role: str = "STAFF"
    companyCode: str | None = None


class User(BaseModel):
    id: int
    email: str
    name: str


class LoginResponse(BaseModel):
    token: str
    role: str
    user: User


class RequestOtpResponse(BaseModel):
    message: str
    retryAfterSeconds: int | None = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_otp(email: str, code: str) -> str:
    value = f"{normalize_email(email)}:{code}:{OTP_SECRET}"
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def create_access_token(user: User, role: str) -> tuple[str, str, datetime, datetime]:
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


def build_login_response(user_row: UserModel, db: Session) -> LoginResponse:
    now = datetime.now(timezone.utc)
    user_row.last_login_at = now
    app_user = User(id=user_row.id, email=user_row.email, name=user_row.full_name)
    token, jti, expires_at, issued_at = create_access_token(app_user, user_row.role)
    db.add(
        AuthSessionModel(
            user_id=user_row.id,
            token_jti=jti,
            issued_at=issued_at,
            expires_at=expires_at,
        )
    )
    db.commit()
    return LoginResponse(token=token, role=user_row.role, user=app_user)


@router.post("/auth/request-otp", response_model=RequestOtpResponse)
def request_otp(payload: RequestOtpRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    now = datetime.now(timezone.utc)

    user = db.query(UserModel).filter(UserModel.email == email, UserModel.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User is not registered or inactive.")

    latest_otp = (
        db.query(EmailOtpModel).filter(EmailOtpModel.email == email).order_by(EmailOtpModel.created_at.desc()).first()
    )
    if latest_otp and latest_otp.created_at:
        seconds_since_last = int((now - latest_otp.created_at).total_seconds())
        if seconds_since_last < OTP_RESEND_SECONDS:
            retry_after = OTP_RESEND_SECONDS - seconds_since_last
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
        raise HTTPException(status_code=500, detail="Failed to send OTP email. Check Brevo configuration.")

    return RequestOtpResponse(message="OTP sent successfully.")


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
        raise HTTPException(status_code=404, detail="No active OTP found for this email. Request a new code.")

    user_row = db.query(UserModel).filter(UserModel.email == email, UserModel.is_active.is_(True)).first()
    if not user_row:
        otp_row.used = True
        db.commit()
        raise HTTPException(status_code=404, detail="User is not registered or inactive.")

    now = datetime.now(timezone.utc)
    if otp_row.expires_at and now > otp_row.expires_at:
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
    return build_login_response(user_row, db)


@router.post("/auth/login", response_model=LoginResponse)
def login_with_password(payload: PasswordLoginRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    user_row = db.query(UserModel).filter(UserModel.email == email, UserModel.is_active.is_(True)).first()
    if not user_row:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if email in DEV_BYPASS_EMAILS:
        if not DEV_BYPASS_PASSWORD:
            raise HTTPException(status_code=500, detail="DEV_BYPASS_PASSWORD is not configured.")
        if payload.password != DEV_BYPASS_PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        return build_login_response(user_row, db)

    if not user_row.password_hash:
        raise HTTPException(status_code=401, detail="Password login is not configured for this user.")
    if not pwd_context.verify(payload.password, user_row.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return build_login_response(user_row, db)


@router.post("/auth/register", response_model=LoginResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    role = payload.role.strip().upper()
    if role not in {"OWNER", "STAFF"}:
        raise HTTPException(status_code=400, detail="Role must be OWNER or STAFF.")
    if role == "OWNER" and not ALLOW_OWNER_SELF_REGISTER:
        raise HTTPException(status_code=403, detail="OWNER self-registration is disabled.")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    company_code = (payload.companyCode or "C1").strip().upper()
    if company_code not in {"C1", "C2"}:
        raise HTTPException(status_code=400, detail="companyCode must be C1 or C2.")

    existing = db.query(UserModel).filter(UserModel.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email is already registered.")

    user_row = UserModel(
        email=email,
        full_name=payload.fullName.strip() or "User",
        role=role,
        company_code=company_code,
        password_hash=pwd_context.hash(payload.password),
        is_active=True,
    )
    db.add(user_row)
    db.commit()
    db.refresh(user_row)
    return build_login_response(user_row, db)


@router.post("/auth/logout")
def logout(current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    active_sessions = (
        db.query(AuthSessionModel)
        .filter(
            AuthSessionModel.user_id == current_user.id,
            AuthSessionModel.revoked_at.is_(None),
        )
        .all()
    )
    now = datetime.now(timezone.utc)
    for session in active_sessions:
        session.revoked_at = now
    db.commit()
    return {"message": "Logged out successfully"}
