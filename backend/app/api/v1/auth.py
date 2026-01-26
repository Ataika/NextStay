from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional

router = APIRouter(tags=["auth"])
security = HTTPBearer(auto_error=False)  # Не требует токен обязательно


# Pydantic models
class LoginRequest(BaseModel):
    email: str
    password: str


class User(BaseModel):
    id: int
    email: str
    name: str


class LoginResponse(BaseModel):
    token: str
    role: str
    user: User


# Заглушки эндпоинтов
@router.post("/auth/login", response_model=LoginResponse)
def login(credentials: LoginRequest):
    """Авторизация пользователя"""
    # TODO: Реализовать проверку учетных данных и генерацию токена
    # Временная заглушка для тестирования
    if credentials.email == "admin@nextstay.com" and credentials.password == "admin":
        return LoginResponse(
            token="temp-admin-token",
            role="OWNER",
            user=User(id=1, email=credentials.email, name="Admin User")
        )
    if credentials.email == "staff@nextstay.com" and credentials.password == "staff":
        return LoginResponse(
            token="temp-staff-token",
            role="STAFF",
            user=User(id=2, email=credentials.email, name="Staff User")
        )
    raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/auth/logout")
def logout(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """Выход пользователя"""
    # TODO: Реализовать инвалидацию токена
    return {"message": "Logged out successfully"}
