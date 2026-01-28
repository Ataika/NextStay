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
