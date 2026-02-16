from datetime import datetime, timezone

from app.core.config import AUTH_JWT_SECRET
from app.db.session import SessionLocal
from app.models.auth_session import AuthSession as AuthSessionModel
from app.models.user import User as UserModel
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

security = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> UserModel:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    token = credentials.credentials
    try:
        payload = jwt.decode(token, AUTH_JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        token_jti = payload.get("jti")
    except JWTError as err:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.") from err

    if not user_id or not token_jti:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.")

    user = db.query(UserModel).filter(UserModel.id == int(user_id), UserModel.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is not active.")

    session = (
        db.query(AuthSessionModel)
        .filter(
            AuthSessionModel.user_id == user.id,
            AuthSessionModel.token_jti == token_jti,
            AuthSessionModel.revoked_at.is_(None),
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is not valid.")

    now = datetime.now(timezone.utc)
    if session.expires_at and now > session.expires_at:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired.")

    return user


def require_roles(*roles: str):
    normalized = {role.upper() for role in roles}

    def checker(user: UserModel = Depends(get_current_user)):
        if user.role.upper() not in normalized:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions.")
        return user

    return checker


def get_user_company_scope(user: UserModel) -> str | None:
    """
    Return company scope for tenant-separated roles.
    OWNER/STAFF are tenant-scoped; if company is missing, deny access.
    """
    role = (user.role or "").upper()
    if role in {"OWNER", "STAFF"}:
        if not user.company_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not assigned to a company.",
            )
        return user.company_code
    return None
