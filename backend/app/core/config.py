import os

from dotenv import load_dotenv

load_dotenv()

# Use DATABASE_URL directly if it's set (for Docker)
# Otherwise build from individual variables
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Build URL from individual variables
    # Use DB_USER, DB_PASSWORD, DB_NAME from .env (as in docker-compose.yml)
    postgres_user = os.getenv('DB_USER') or os.getenv('POSTGRES_USER', 'nextstay')
    postgres_password = os.getenv('DB_PASSWORD') or os.getenv('POSTGRES_PASSWORD', 'nextstay')
    postgres_host = os.getenv('POSTGRES_HOST', 'localhost')
    postgres_port = os.getenv('POSTGRES_PORT', '5433')  # Docker uses 5433
    postgres_db = os.getenv('DB_NAME') or os.getenv('POSTGRES_DB', 'nextstay')

    DATABASE_URL = (
        f"postgresql://{postgres_user}:"
        f"{postgres_password}@"
        f"{postgres_host}:"
        f"{postgres_port}/"
        f"{postgres_db}"
    )

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

# Dev auth bypass (password login without OTP for selected emails)
DEV_BYPASS_EMAILS = [
    email.strip().lower()
    for email in os.getenv(
        "DEV_BYPASS_EMAILS",
        "nextstay@yandex.com,staff.uborka@yandex.com",
    ).split(",")
    if email.strip()
]
DEV_BYPASS_PASSWORD = os.getenv("DEV_BYPASS_PASSWORD", "")

# Registration settings
ALLOW_OWNER_SELF_REGISTER = os.getenv("ALLOW_OWNER_SELF_REGISTER", "false").lower() == "true"

# Dev: when Brevo is not configured, print OTP to backend console instead of failing (no real email sent)
DEV_OTP_LOG_TO_CONSOLE = os.getenv("DEV_OTP_LOG_TO_CONSOLE", "false").lower() == "true"
