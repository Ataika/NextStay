from app.api.v1.auth import hash_password
from app.models.user import User

from tests.conftest import login_owner, make_owner


def _create_staff_user(db, email="staff@test.com", hotel_id=None):
    if hotel_id is None:
        owner = make_owner(db)
        hid = owner.hotel_id
    else:
        hid = hotel_id
    user = User(
        email=email,
        full_name="Staff User",
        role="STAFF",
        is_active=True,
        password_hash=hash_password("Password1!"),
        hotel_id=hid,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


class TestStaffProfile:
    def test_staff_me_auto_creates_cleaner_profile(self, client, db):
        user = _create_staff_user(db)
        login = client.post(
            "/api/v1/auth/login",
            json={"email": user.email, "password": "Password1!"},
        )
        token = login.json()["token"]

        resp = client.get("/api/v1/staff/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["role"] == "cleaner"
        assert data["email"] == user.email


class TestStaffCRUD:
    def test_list_staff_requires_auth(self, client, db):
        resp = client.get("/api/v1/staff")
        assert resp.status_code == 401

    def test_list_staff_scoped_to_hotel(self, client, db, monkeypatch):
        from app.api.v1 import staff as staff_module

        owner = make_owner(db, email="owner-a@test.com", hotel_name="Hotel A")
        captured: dict[str, int | None] = {}

        def mock_fetch(db_session, staff_id=None, hotel_id=None):
            captured["hotel_id"] = hotel_id
            if hotel_id == owner.hotel_id:
                return [
                    {
                        "id": 1,
                        "name": "Alice",
                        "role": "cleaner",
                        "email": "alice@test.com",
                        "phone": None,
                        "hire_date": None,
                        "is_active": True,
                        "annual_days_off": 20,
                        "hours_this_month": 0.0,
                        "days_off_this_year": 0,
                    }
                ]
            return []

        monkeypatch.setattr(staff_module, "_fetch_stats", mock_fetch)

        resp = client.post(
            "/api/v1/auth/login",
            json={"email": owner.email, "password": "Password1!"},
        )
        token = resp.json()["token"]
        list_resp = client.get("/api/v1/staff", headers={"Authorization": f"Bearer {token}"})
        assert list_resp.status_code == 200, list_resp.text
        assert captured["hotel_id"] == owner.hotel_id
        names = {member["name"] for member in list_resp.json()}
        assert names == {"Alice"}

    def test_list_staff_empty(self, client, db, monkeypatch):
        from app.api.v1 import staff as staff_module

        monkeypatch.setattr(staff_module, "_fetch_stats", lambda db, staff_id=None, hotel_id=None: [])
        make_owner(db)
        token = login_owner(client)
        resp = client.get("/api/v1/staff", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_staff_member_invalid_role(self, client, db, monkeypatch):
        from app.api.v1 import staff as staff_module

        monkeypatch.setattr(staff_module, "_fetch_stats", lambda db, staff_id=None, hotel_id=None: [])
        make_owner(db)
        token = login_owner(client)
        resp = client.post(
            "/api/v1/staff",
            json={"name": "Alice", "role": "INVALID_ROLE"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_create_staff_member_success(self, client, db, monkeypatch):
        from app.api.v1 import staff as staff_module

        def _mock_fetch(db, staff_id=None, hotel_id=None):
            if staff_id is not None:
                return [
                    {
                        "id": staff_id,
                        "name": "Alice",
                        "role": "cleaner",
                        "email": None,
                        "phone": None,
                        "hire_date": None,
                        "is_active": True,
                        "annual_days_off": 20,
                        "hours_this_month": 0.0,
                        "days_off_this_year": 0,
                    }
                ]
            return []

        monkeypatch.setattr(staff_module, "_fetch_stats", _mock_fetch)
        make_owner(db)
        token = login_owner(client)
        resp = client.post(
            "/api/v1/staff",
            json={"name": "Alice", "role": "cleaner"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Alice"
        assert resp.json()["role"] == "cleaner"

    def test_create_staff_member_invalid_hire_date(self, client, db, monkeypatch):
        from app.api.v1 import staff as staff_module

        monkeypatch.setattr(staff_module, "_fetch_stats", lambda db, staff_id=None, hotel_id=None: [])
        make_owner(db)
        token = login_owner(client)
        resp = client.post(
            "/api/v1/staff",
            json={"name": "Bob", "role": "manager", "hire_date": "not-a-date"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
