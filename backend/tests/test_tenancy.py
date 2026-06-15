"""Multi-hotel isolation tests."""

from app.api.v1.auth import hash_password
from app.models.hotel_profile import HotelProfile
from app.models.user import User

from .conftest import make_owner


def _login(client, email: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "Password1!"})
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


class TestHotelTenancy:
    def test_team_list_is_scoped_to_hotel(self, client, db):
        make_owner(db, email="owner-a@test.com", hotel_name="Hotel A")

        hotel_b = HotelProfile(hotel_name="Hotel B")
        db.add(hotel_b)
        db.flush()
        owner_b = User(
            email="owner-b@test.com",
            full_name="Owner B",
            role="OWNER",
            is_active=True,
            password_hash=hash_password("Password1!"),
            hotel_id=hotel_b.id,
        )
        staff_b = User(
            email="staff-b@test.com",
            full_name="Staff B",
            role="STAFF",
            is_active=True,
            password_hash=hash_password("Password1!"),
            hotel_id=hotel_b.id,
        )
        db.add_all([owner_b, staff_b])
        db.commit()

        token = _login(client, "owner-a@test.com")
        resp = client.get("/api/v1/users", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        emails = {row["email"] for row in resp.json()}
        assert emails == {"owner-a@test.com"}
        assert "owner-b@test.com" not in emails
        assert "staff-b@test.com" not in emails

    def test_owner_cannot_update_user_from_other_hotel(self, client, db):
        make_owner(db, email="owner-a@test.com", hotel_name="Hotel A")

        hotel_b = HotelProfile(hotel_name="Hotel B")
        db.add(hotel_b)
        db.flush()
        staff_b = User(
            email="staff-b@test.com",
            full_name="Staff B",
            role="STAFF",
            is_active=True,
            password_hash=hash_password("Password1!"),
            hotel_id=hotel_b.id,
        )
        db.add(staff_b)
        db.commit()
        db.refresh(staff_b)

        token = _login(client, "owner-a@test.com")
        resp = client.patch(
            f"/api/v1/users/{staff_b.id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"role": "MANAGER"},
        )
        assert resp.status_code == 404
