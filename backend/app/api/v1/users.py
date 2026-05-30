from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.user import User as UserModel
from app.security.auth import get_user_company_scope, require_roles

router = APIRouter(tags=["users"])


def get_db():
  db = SessionLocal()
  try:
      yield db
  finally:
      db.close()


class StaffUser(BaseModel):
  id: int
  fullName: str
  email: str


@router.get("/users/staff", response_model=List[StaffUser])
def list_staff_users(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles("OWNER", "STAFF")),
):
  """
  List active STAFF users within the same company as current user.
  Used for assigning cleaning tasks.
  """
  company_code = get_user_company_scope(current_user)
  rows = (
      db.query(UserModel)
      .filter(
          UserModel.role == "STAFF",
          UserModel.is_active.is_(True),
          UserModel.company_code == company_code,
      )
      .order_by(UserModel.full_name.asc())
      .all()
  )
  return [
      StaffUser(id=row.id, fullName=row.full_name, email=row.email)
      for row in rows
  ]

