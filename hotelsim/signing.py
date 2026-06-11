"""HMAC-SHA256 signing for hotel-sim ↔ PMS webhooks (self-contained copy)."""

import hashlib
import hmac

_PREFIX = "sha256="


def sign_payload(raw_body: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return f"{_PREFIX}{digest}"


def verify_signature(raw_body: bytes, secret: str, provided: str | None) -> bool:
    if not provided or not provided.startswith(_PREFIX):
        return False
    return hmac.compare_digest(sign_payload(raw_body, secret), provided)
