from app.api.v1.hotel_sync import should_publish_outbound
from app.core.hotel_sync_security import sign_payload, verify_signature


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
