from hotelsim.signing import sign_payload, verify_signature


def test_sign_and_verify_roundtrip():
    body = b'{"x":1}'
    sig = sign_payload(body, "secret")
    assert sig.startswith("sha256=")
    assert verify_signature(body, "secret", sig) is True
    assert verify_signature(b'{"x":2}', "secret", sig) is False
    assert verify_signature(body, "secret", None) is False
