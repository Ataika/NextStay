#!/usr/bin/env python3
"""
Create manager login accounts for Staff Manager, Inventory Manager, Hostess Manager.
Run from the backend directory:
  cd backend && python ../scripts/create_managers.py
"""

import hashlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/backend")

from app.db.session import SessionLocal
from app.models.user import User as UserModel

_PBKDF2_ITERS = 260_000


def hash_password(password: str) -> str:
    salt = os.urandom(32)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERS)
    return salt.hex() + ":" + dk.hex()


MANAGERS = [
    {
        "email": "staffmanager@nextstay.com",
        "full_name": "Staff Manager",
        "password": "StaffMgr2026!",
        "role": "MANAGER",
    },
    {
        "email": "inventorymanager@nextstay.com",
        "full_name": "Inventory Manager",
        "password": "InvMgr2026!",
        "role": "MANAGER",
    },
    {
        "email": "hostessmanager@nextstay.com",
        "full_name": "Hostess Manager",
        "password": "HostMgr2026!",
        "role": "MANAGER",
    },
]


def main():
    db = SessionLocal()
    try:
        for m in MANAGERS:
            existing = db.query(UserModel).filter(UserModel.email == m["email"]).first()
            if existing:
                print(f"  SKIP  {m['email']} (already exists)")
                continue
            user = UserModel(
                email=m["email"],
                full_name=m["full_name"],
                role=m["role"],
                password_hash=hash_password(m["password"]),
                is_active=True,
            )
            db.add(user)
            print(f"  ADD   {m['email']}  password={m['password']}")
        db.commit()
        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
