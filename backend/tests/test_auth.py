"""Auth endpoint tests: password login, lockout, OTP flow, password strength."""

from .conftest import make_owner

# ---------------------------------------------------------------------------
# Password login
# ---------------------------------------------------------------------------


class TestPasswordLogin:
    def test_login_success(self, client, db):
        make_owner(db)
        resp = client.post(
            "/api/v1/auth/login",
            json={
                "email": "owner@test.com",
                "password": "Password1!",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["role"] == "OWNER"
        assert data["user"]["email"] == "owner@test.com"

    def test_login_wrong_password(self, client, db):
        make_owner(db)
        resp = client.post(
            "/api/v1/auth/login",
            json={
                "email": "owner@test.com",
                "password": "WrongPass1!",
            },
        )
        assert resp.status_code == 401

    def test_login_unknown_email(self, client, db):
        resp = client.post(
            "/api/v1/auth/login",
            json={
                "email": "nobody@test.com",
                "password": "Password1!",
            },
        )
        assert resp.status_code == 401

    def test_login_inactive_user(self, client, db):
        from app.api.v1.auth import hash_password
        from app.models.user import User

        user = User(
            email="inactive@test.com",
            full_name="Inactive",
            role="STAFF",
            is_active=False,
            password_hash=hash_password("Password1!"),
        )
        db.add(user)
        db.commit()
        resp = client.post(
            "/api/v1/auth/login",
            json={
                "email": "inactive@test.com",
                "password": "Password1!",
            },
        )
        assert resp.status_code == 401

    def test_login_email_case_insensitive(self, client, db):
        make_owner(db)
        resp = client.post(
            "/api/v1/auth/login",
            json={
                "email": "OWNER@TEST.COM",
                "password": "Password1!",
            },
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Account lockout
# ---------------------------------------------------------------------------


class TestAccountLockout:
    def test_lockout_after_five_failures(self, client, db):
        make_owner(db)
        for _ in range(5):
            r = client.post(
                "/api/v1/auth/login",
                json={
                    "email": "owner@test.com",
                    "password": "WrongPass1!",
                },
            )
            assert r.status_code == 401

        # 6th attempt should be locked (429)
        r = client.post(
            "/api/v1/auth/login",
            json={
                "email": "owner@test.com",
                "password": "Password1!",  # even correct password is locked out
            },
        )
        assert r.status_code == 429
        assert "locked" in r.json()["detail"].lower()

    def test_failed_attempts_reset_on_success(self, client, db):
        make_owner(db)
        # 3 failures (below threshold)
        for _ in range(3):
            client.post(
                "/api/v1/auth/login",
                json={
                    "email": "owner@test.com",
                    "password": "Wrong1!",
                },
            )
        # Successful login resets counter
        r = client.post(
            "/api/v1/auth/login",
            json={
                "email": "owner@test.com",
                "password": "Password1!",
            },
        )
        assert r.status_code == 200
        # Check counter was reset in DB
        from app.models.user import User

        user = db.query(User).filter_by(email="owner@test.com").first()
        assert user.failed_login_attempts == 0


# ---------------------------------------------------------------------------
# Password complexity (change-password endpoint)
# ---------------------------------------------------------------------------


class TestPasswordComplexity:
    def _token(self, client, db):
        make_owner(db)
        r = client.post(
            "/api/v1/auth/login",
            json={
                "email": "owner@test.com",
                "password": "Password1!",
            },
        )
        return r.json()["token"]

    def test_change_password_too_short(self, client, db):
        tok = self._token(client, db)
        r = client.post(
            "/api/v1/auth/change-password",
            json={
                "currentPassword": "Password1!",
                "newPassword": "Aa1!",
            },
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 400

    def test_change_password_no_uppercase(self, client, db):
        tok = self._token(client, db)
        r = client.post(
            "/api/v1/auth/change-password",
            json={
                "currentPassword": "Password1!",
                "newPassword": "password1!x",
            },
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 400

    def test_change_password_no_digit(self, client, db):
        tok = self._token(client, db)
        r = client.post(
            "/api/v1/auth/change-password",
            json={
                "currentPassword": "Password1!",
                "newPassword": "PasswordABC!",
            },
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 400

    def test_change_password_no_special(self, client, db):
        tok = self._token(client, db)
        r = client.post(
            "/api/v1/auth/change-password",
            json={
                "currentPassword": "Password1!",
                "newPassword": "Password123",
            },
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 400

    def test_change_password_success(self, client, db):
        tok = self._token(client, db)
        r = client.post(
            "/api/v1/auth/change-password",
            json={
                "currentPassword": "Password1!",
                "newPassword": "NewPassword2@",
            },
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 204

    def test_change_password_wrong_current(self, client, db):
        tok = self._token(client, db)
        r = client.post(
            "/api/v1/auth/change-password",
            json={
                "currentPassword": "WrongCurrent1!",
                "newPassword": "NewPassword2@",
            },
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Forgot / reset password
# ---------------------------------------------------------------------------


class TestForgotResetPassword:
    def test_forgot_unknown_email_returns_200(self, client, db):
        """Must not reveal whether email exists."""
        r = client.post(
            "/api/v1/auth/forgot-password",
            json={
                "email": "ghost@nobody.com",
            },
        )
        assert r.status_code == 200

    def test_reset_password_validates_strength(self, client, db):
        from datetime import datetime, timedelta, timezone

        from app.api.v1.auth import hash_otp
        from app.models.email_otp import EmailOtp

        make_owner(db)
        code = "123456"
        otp = EmailOtp(
            email="owner@test.com",
            code_hash=hash_otp("owner@test.com", code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            attempts=0,
            used=False,
        )
        db.add(otp)
        db.commit()

        r = client.post(
            "/api/v1/auth/reset-password",
            json={
                "email": "owner@test.com",
                "code": code,
                "newPassword": "weak",
            },
        )
        assert r.status_code == 400

    def test_reset_password_success(self, client, db):
        from datetime import datetime, timedelta, timezone

        from app.api.v1.auth import hash_otp
        from app.models.email_otp import EmailOtp

        make_owner(db)
        code = "654321"
        otp = EmailOtp(
            email="owner@test.com",
            code_hash=hash_otp("owner@test.com", code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            attempts=0,
            used=False,
        )
        db.add(otp)
        db.commit()

        r = client.post(
            "/api/v1/auth/reset-password",
            json={
                "email": "owner@test.com",
                "code": code,
                "newPassword": "ResetPass1!",
            },
        )
        assert r.status_code == 204

        # Can login with new password
        r2 = client.post(
            "/api/v1/auth/login",
            json={
                "email": "owner@test.com",
                "password": "ResetPass1!",
            },
        )
        assert r2.status_code == 200
