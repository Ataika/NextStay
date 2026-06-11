import pytest
from app.api.v1.hotel_sync import should_publish_outbound
from app.core.hotel_sync_security import sign_payload, verify_signature
from fastapi import HTTPException


def test_sign_payload_is_deterministic_and_prefixed():
    sig = sign_payload(b'{"a":1}', "secret")
    assert sig.startswith("sha256=")
    assert sig == sign_payload(b'{"a":1}', "secret")


def test_verify_accepts_matching_signature():
    body = b'{"event":"x"}'
    sig = sign_payload(body, "secret")
    assert verify_signature(body, "secret", sig) is True


def test_verify_rejects_tampered_body():
    sig = sign_payload(b'{"event":"x"}', "secret")
    assert verify_signature(b'{"event":"y"}', "secret", sig) is False


def test_verify_rejects_wrong_secret():
    body = b'{"event":"x"}'
    sig = sign_payload(body, "secret")
    assert verify_signature(body, "other", sig) is False


def test_verify_rejects_garbage_or_missing_header():
    body = b'{"event":"x"}'
    assert verify_signature(body, "secret", "") is False
    assert verify_signature(body, "secret", "not-a-sig") is False
    assert verify_signature(body, "secret", None) is False


def test_should_publish_outbound_only_for_pms_origin():
    assert should_publish_outbound("PMS") is True
    assert should_publish_outbound("HOTEL") is False
    assert should_publish_outbound(None) is False


class _Hotel:
    def __init__(self, secret):
        self.hmac_secret = secret


def test_authorize_inbound_hmac_ok(monkeypatch):
    import app.api.v1.hotel_sync as hs

    monkeypatch.setattr(hs, "HOTEL_SYNC_HMAC_ENABLED", True)
    body = b'{"x":1}'
    good = sign_payload(body, "secret")
    hs.authorize_inbound(_Hotel("secret"), body, good, token=None)  # no raise


def test_authorize_inbound_hmac_bad_sig_401(monkeypatch):
    import app.api.v1.hotel_sync as hs

    monkeypatch.setattr(hs, "HOTEL_SYNC_HMAC_ENABLED", True)
    with pytest.raises(HTTPException) as exc:
        hs.authorize_inbound(_Hotel("secret"), b'{"x":1}', "sha256=deadbeef", token=None)
    assert exc.value.status_code == 401


def test_authorize_inbound_token_fallback(monkeypatch):
    import app.api.v1.hotel_sync as hs

    monkeypatch.setattr(hs, "HOTEL_SYNC_HMAC_ENABLED", False)
    monkeypatch.setattr(hs, "HOTEL_SYNC_TOKEN_ENABLED", True)
    monkeypatch.setattr(hs, "HOTEL_SYNC_TOKEN", "tok")
    with pytest.raises(HTTPException) as exc:
        hs.authorize_inbound(None, b"{}", None, token="wrong")
    assert exc.value.status_code == 401
    hs.authorize_inbound(None, b"{}", None, token="tok")  # no raise
