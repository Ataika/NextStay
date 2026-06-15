"""Team user management permissions (owner vs manager)."""

from app.api.v1.auth import hash_password
from app.models.user import User

from .conftest import make_owner


def _create_manager(db, hotel_id: int):
    user = User(
        email="manager@test.com",
        full_name="Test Manager",
        role="MANAGER",
        is_active=True,
        password_hash=hash_password("Password1!"),
        hotel_id=hotel_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _login(client, email: str, password: str = "Password1!") -> str:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


class TestTeamUsers:
    def test_owner_can_create_staff(self, client, db):
        make_owner(db)
        token = _login(client, "owner@test.com")
        resp = client.post(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "email": "newstaff@test.com",
                "full_name": "New Staff",
                "role": "STAFF",
                "password": "Password1!",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["role"] == "STAFF"

    def test_manager_can_create_staff(self, client, db):
        owner = make_owner(db)
        _create_manager(db, owner.hotel_id)
        token = _login(client, "manager@test.com")
        resp = client.post(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "email": "staff2@test.com",
                "full_name": "Staff Two",
                "role": "STAFF",
                "password": "Password1!",
            },
        )
        assert resp.status_code == 201

    def test_manager_cannot_create_manager(self, client, db):
        owner = make_owner(db)
        _create_manager(db, owner.hotel_id)
        token = _login(client, "manager@test.com")
        resp = client.post(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "email": "mgr2@test.com",
                "full_name": "Another Manager",
                "role": "MANAGER",
                "password": "Password1!",
            },
        )
        assert resp.status_code == 403

    def test_owner_can_change_role(self, client, db):
        owner = make_owner(db)
        token = _login(client, "owner@test.com")
        staff = User(
            email="promote@test.com",
            full_name="Promote Me",
            role="STAFF",
            is_active=True,
            password_hash=hash_password("Password1!"),
            hotel_id=owner.hotel_id,
        )
        db.add(staff)
        db.commit()
        db.refresh(staff)

        resp = client.patch(
            f"/api/v1/users/{staff.id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"role": "MANAGER"},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "MANAGER"

    def test_manager_cannot_change_role(self, client, db):
        owner = make_owner(db)
        _create_manager(db, owner.hotel_id)
        staff = User(
            email="locked@test.com",
            full_name="Locked Staff",
            role="STAFF",
            is_active=True,
            password_hash=hash_password("Password1!"),
            hotel_id=owner.hotel_id,
        )
        db.add(staff)
        db.commit()
        db.refresh(staff)

        token = _login(client, "manager@test.com")
        resp = client.patch(
            f"/api/v1/users/{staff.id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"role": "MANAGER"},
        )
        assert resp.status_code == 403

    def test_owner_can_delete_staff_user(self, client, db):
        owner = make_owner(db)
        staff = User(
            email="delete@test.com",
            full_name="Delete Me",
            role="STAFF",
            is_active=True,
            password_hash=hash_password("Password1!"),
            hotel_id=owner.hotel_id,
        )
        db.add(staff)
        db.commit()
        db.refresh(staff)

        token = _login(client, "owner@test.com")
        resp = client.delete(
            f"/api/v1/users/{staff.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 204

    def test_manager_cannot_delete_user(self, client, db):
        owner = make_owner(db)
        _create_manager(db, owner.hotel_id)
        staff = User(
            email="nodelete@test.com",
            full_name="Keep Me",
            role="STAFF",
            is_active=True,
            password_hash=hash_password("Password1!"),
            hotel_id=owner.hotel_id,
        )
        db.add(staff)
        db.commit()
        db.refresh(staff)

        token = _login(client, "manager@test.com")
        resp = client.delete(
            f"/api/v1/users/{staff.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
