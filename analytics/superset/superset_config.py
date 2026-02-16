# Local development config for embedding Superset in the frontend app.

FEATURE_FLAGS = {
    "EMBEDDED_SUPERSET": True,
}

# Disable Talisman protections in local dev to allow iframe embedding.
TALISMAN_ENABLED = False

# Allow embedding from local frontend host.
OVERRIDE_HTTP_HEADERS = {
    "X-Frame-Options": "ALLOWALL",
    "Content-Security-Policy": "frame-ancestors 'self' http://localhost:5173 http://127.0.0.1:5173;",
}
