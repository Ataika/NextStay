"""Registration and staff invite tests."""

from unittest.mock import patch

from app.api.v1.auth import hash_password
from app.models.hotel_invite import HotelInvite
from app.models.hotel_profile import HotelProfile
from app.models.user import User

from .conftest import make_owner


class TestOwnerRegistration:
    def test_register_owner_success(self, client):
        resp = client.post(
            "/api/v1/auth/register/owner",
            json={
                "hotel_name": "Sunrise Inn",
                "first_name": "Anna",
                "last_name": "Owner",
                "email": "anna@hotel.com",
                "password": "Password1!",
                "birth_year": 1990,
                "gender": "female",
            },
        )
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["role"] == "OWNER"
        assert data["user"]["email"] == "anna@hotel.com"
        assert "token" in data

    def test_register_owner_duplicate_email(self, client, db):
        make_owner(db)
        resp = client.post(
            "/api/v1/auth/register/owner",
            json={
                "hotel_name": "Another Hotel",
                "first_name": "Bob",
                "last_name": "Dup",
                "email": "owner@test.com",
                "password": "Password1!",
                "birth_year": 1985,
                "gender": "male",
            },
        )
        assert resp.status_code == 409


class TestStaffRegistration:
    def _create_invite(self, db, email="staff@invite.com", hotel_name="Test Hotel"):
        hotel = HotelProfile(hotel_name=hotel_name)
        db.add(hotel)
        db.flush()
        owner = User(
            email="ceo@hotel.com",
            full_name="CEO",
            role="OWNER",
            is_active=True,
            password_hash=hash_password("Password1!"),
            hotel_id=hotel.id,
        )
        db.add(owner)
        db.flush()
        invite = HotelInvite(
            hotel_id=hotel.id,
            email=email,
            code="ABCD1234",
            created_by=owner.id,
            expires_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc)
            + __import__("datetime").timedelta(days=7),
        )
        db.add(invite)
        db.commit()
        return invite

    def test_verify_and_register_staff(self, client, db):
        self._create_invite(db)
        verify = client.post(
            "/api/v1/auth/register/verify-invite",
            json={"code": "ABCD1234"},
        )
        assert verify.status_code == 200
        assert verify.json()["email"] == "staff@invite.com"

        resp = client.post(
            "/api/v1/auth/register/staff",
            json={
                "code": "ABCD1234",
                "first_name": "Maria",
                "last_name": "Staff",
                "email": "staff@invite.com",
                "password": "Password1!",
                "birth_year": 2000,
                "gender": "female",
            },
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["role"] == "STAFF"

        me = client.get(
            "/api/v1/staff/me",
            headers={"Authorization": f"Bearer {resp.json()['token']}"},
        )
        assert me.status_code == 200, me.text
        assert me.json()["role"] == "cleaner"

    def test_register_staff_wrong_email(self, client, db):
        self._create_invite(db)
        resp = client.post(
            "/api/v1/auth/register/staff",
            json={
                "code": "ABCD1234",
                "first_name": "Maria",
                "last_name": "Staff",
                "email": "wrong@invite.com",
                "password": "Password1!",
                "birth_year": 2000,
                "gender": "female",
            },
        )
        assert resp.status_code == 400


class TestUserInvite:
    def test_owner_can_invite_staff(self, client, db):
        hotel = HotelProfile(hotel_name="Invite Hotel")
        db.add(hotel)
        db.flush()
        owner = User(
            email="owner@invite.com",
            full_name="Owner",
            role="OWNER",
            is_active=True,
            password_hash=hash_password("Password1!"),
            hotel_id=hotel.id,
        )
        db.add(owner)
        db.commit()

        login = client.post(
            "/api/v1/auth/login",
            json={"email": "owner@invite.com", "password": "Password1!"},
        )
        assert login.status_code == 200, login.text
        token = login.json()["token"]

        with patch("app.api.v1.users.send_hotel_invite_email", return_value=True):
            resp = client.post(
                "/api/v1/users/invite",
                headers={"Authorization": f"Bearer {token}"},
                json={"email": "newstaff@hotel.com"},
            )
        assert resp.status_code == 201
        assert "sent" in resp.json()["message"].lower()
