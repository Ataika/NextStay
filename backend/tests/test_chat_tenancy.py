from app.api.v1.auth import hash_password
from app.models.hotel_profile import HotelProfile
from app.models.user import User

from tests.conftest import make_owner


def _login(client, email: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "Password1!"})
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


class TestChatHotelIsolation:
    def test_search_users_only_same_hotel(self, client, db):
        owner_a = make_owner(db, email="owner-a@test.com", hotel_name="Hotel A")

        hotel_b = HotelProfile(hotel_name="Hotel B")
        db.add(hotel_b)
        db.flush()
        user_b = User(
            email="staff-b@test.com",
            full_name="Staff B",
            role="STAFF",
            is_active=True,
            password_hash=hash_password("Password1!"),
            hotel_id=hotel_b.id,
        )
        db.add(user_b)
        db.commit()

        token = _login(client, "owner-a@test.com")
        resp = client.get(
            "/api/v1/chat/users?query=staff",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        emails = {row["email"] for row in resp.json()}
        assert "staff-b@test.com" not in emails

    def test_general_chat_is_per_hotel(self, client, db):
        owner_a = make_owner(db, email="owner-a@test.com", hotel_name="Hotel A")
        token_a = _login(client, "owner-a@test.com")

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
        db.add(owner_b)
        db.commit()
        token_b = _login(client, "owner-b@test.com")

        resp_a = client.get("/api/v1/chat/conversations", headers={"Authorization": f"Bearer {token_a}"})
        resp_b = client.get("/api/v1/chat/conversations", headers={"Authorization": f"Bearer {token_b}"})
        assert resp_a.status_code == 200
        assert resp_b.status_code == 200

        titles_a = {row["title"] for row in resp_a.json()}
        titles_b = {row["title"] for row in resp_b.json()}
        assert "Hotel A staff" in titles_a
        assert "Hotel B staff" in titles_b
        assert "Hotel B staff" not in titles_a
        assert "Hotel A staff" not in titles_b

        participant_ids_a = {p["user_id"] for row in resp_a.json() for p in row["participants"]}
        assert owner_a.id in participant_ids_a
        assert owner_b.id not in participant_ids_a
