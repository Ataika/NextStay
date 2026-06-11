import os

from dotenv import load_dotenv

load_dotenv()

# Use DATABASE_URL directly if it's set (for Docker)
# Otherwise build from individual variables
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Build URL from individual variables
    # Use DB_USER, DB_PASSWORD, DB_NAME from .env (as in docker-compose.yml)
    postgres_user = os.getenv("DB_USER") or os.getenv("POSTGRES_USER", "nextstay")
    postgres_password = os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", "nextstay")
    postgres_host = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port = os.getenv("POSTGRES_PORT", "5433")  # Docker uses 5433
    postgres_db = os.getenv("DB_NAME") or os.getenv("POSTGRES_DB", "nextstay")

    DATABASE_URL = f"postgresql://{postgres_user}:{postgres_password}@{postgres_host}:{postgres_port}/{postgres_db}"

# Stripe configuration
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Email configuration (SMTP)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "noreply@nextstay.com")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "NextStay")

# Frontend URL for redirects
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# CORS — read comma-separated list from env; fall back to localhost dev origins only
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS: list[str] = (
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
    if _raw_origins
    else [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
)

# Brevo email (OTP)
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "")
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "NextStay")

# OTP/Auth settings
OTP_EXP_MINUTES = int(os.getenv("OTP_EXP_MINUTES", "5"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))
OTP_RESEND_SECONDS = int(os.getenv("OTP_RESEND_SECONDS", "60"))
OTP_SECRET = os.getenv("OTP_SECRET", "change-me-in-production")
AUTH_JWT_SECRET = os.getenv("AUTH_JWT_SECRET", "change-me-in-production")
AUTH_TOKEN_EXPIRES_MINUTES = int(os.getenv("AUTH_TOKEN_EXPIRES_MINUTES", "720"))

# Local dev owner token bridge
DEV_OWNER_TOKEN_ENABLED = (
    os.getenv("DEV_OWNER_TOKEN_ENABLED", os.getenv("PRICING_LAB_ALLOW_DEV_TOKEN", "true")).strip().lower() == "true"
)
DEV_OWNER_TOKEN = os.getenv("DEV_OWNER_TOKEN", os.getenv("PRICING_LAB_DEV_TOKEN", "mock-admin-token"))

# Pricing lab dev access remains aliased to the shared dev owner token
PRICING_LAB_ALLOW_DEV_TOKEN = DEV_OWNER_TOKEN_ENABLED
PRICING_LAB_DEV_TOKEN = DEV_OWNER_TOKEN

# External hotel-site synchronization simulator
HOTEL_SYNC_TOKEN_ENABLED = os.getenv("HOTEL_SYNC_TOKEN_ENABLED", "true").strip().lower() == "true"
HOTEL_SYNC_TOKEN = os.getenv("HOTEL_SYNC_TOKEN", "dev-hotel-sync-token")
