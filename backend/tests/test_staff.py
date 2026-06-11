from tests.conftest import login_owner, make_owner


class TestShiftCode:
    def test_get_shift_code_requires_auth(self, client, db):
        resp = client.get("/api/v1/staff/shift-code")
        assert resp.status_code == 401

    def test_get_shift_code_returns_six_digits(self, client, db):
        make_owner(db)
        token = login_owner(client)
        resp = client.get("/api/v1/staff/shift-code", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["code"]) == 6
        assert data["code"].isdigit()
        assert 0 < data["expires_in"] <= 120

    def test_shift_start_valid_code(self, client, db):
        make_owner(db)
        token = login_owner(client)
        code = client.get("/api/v1/staff/shift-code", headers={"Authorization": f"Bearer {token}"}).json()["code"]
        resp = client.post(
            "/api/v1/staff/shift-start",
            json={"code": code},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert "started_at" in resp.json()

    def test_shift_start_invalid_code(self, client, db):
        make_owner(db)
        token = login_owner(client)
        resp = client.post(
            "/api/v1/staff/shift-start",
            json={"code": "000000"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 401
        assert "invalid" in resp.json()["detail"].lower()

    def test_shift_start_requires_auth(self, client, db):
        resp = client.post("/api/v1/staff/shift-start", json={"code": "123456"})
        assert resp.status_code == 401

    def test_heartbeat(self, client, db):
        make_owner(db)
        token = login_owner(client)
        resp = client.post("/api/v1/staff/heartbeat", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 204


class TestStaffCRUD:
    def test_list_staff_requires_auth(self, client, db):
        resp = client.get("/api/v1/staff")
        assert resp.status_code == 401

    def test_list_staff_empty(self, client, db, monkeypatch):
        from app.api.v1 import staff as staff_module

        monkeypatch.setattr(staff_module, "_fetch_stats", lambda db, staff_id=None: [])
        make_owner(db)
        token = login_owner(client)
        resp = client.get("/api/v1/staff", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_staff_member_invalid_role(self, client, db, monkeypatch):
        from app.api.v1 import staff as staff_module

        monkeypatch.setattr(staff_module, "_fetch_stats", lambda db, staff_id=None: [])
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

        def _mock_fetch(db, staff_id=None):
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

        monkeypatch.setattr(staff_module, "_fetch_stats", lambda db, staff_id=None: [])
        make_owner(db)
        token = login_owner(client)
        resp = client.post(
            "/api/v1/staff",
            json={"name": "Bob", "role": "manager", "hire_date": "not-a-date"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
