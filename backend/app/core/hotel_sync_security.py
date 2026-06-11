"""HMAC-SHA256 signing/verification for hotel-sync webhook payloads.

Pure functions (no DB, no FastAPI) so they are trivially unit-testable.
The signature is computed over the RAW request body bytes, never the parsed
model, so re-serialization differences cannot break verification.
"""

import hashlib
import hmac

_PREFIX = "sha256="


def sign_payload(raw_body: bytes, secret: str) -> str:
    """Return 'sha256=<hexdigest>' for the given raw body and shared secret."""
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return f"{_PREFIX}{digest}"


def verify_signature(raw_body: bytes, secret: str, provided: str | None) -> bool:
    """Constant-time check that `provided` matches the signature of `raw_body`.

    Returns False for missing/malformed signatures instead of raising.
    """
    if not provided or not provided.startswith(_PREFIX):
        return False
    expected = sign_payload(raw_body, secret)
    return hmac.compare_digest(expected, provided)
