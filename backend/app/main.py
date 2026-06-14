import os
import sys
from pathlib import Path

from app.api.v1.auth import router as auth_router
from app.api.v1.bookings import router as bookings_router
from app.api.v1.chat import router as chat_router
from app.api.v1.guest import router as guest_router
from app.api.v1.health import router as health_router
from app.api.v1.holds import router as holds_router
from app.api.v1.hotel_profile import router as hotel_profile_router
from app.api.v1.inventory_setup import router as inventory_setup_router
from app.api.v1.pricing_config import router as pricing_config_router
from app.api.v1.pricing_lab import router as pricing_lab_router
from app.api.v1.pricing_pipeline import router as pricing_pipeline_router
from app.api.v1.rooms import router as rooms_router
from app.api.v1.staff import router as staff_router
from app.api.v1.stripe import router as stripe_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.training import router as training_router
from app.api.v1.register import router as register_router
from app.api.v1.users import router as users_router
from app.core.config import ALLOWED_ORIGINS, AUTH_JWT_SECRET, DEV_OWNER_TOKEN_ENABLED
from app.core.limiter import limiter
from app.core.logging import configure_logging, get_logger, new_request_id, request_id_var
from app.db.bootstrap import prepare_database
from app.exceptions import register_exception_handlers
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

configure_logging()
logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Startup safety checks
# ---------------------------------------------------------------------------

INSECURE_JWT_DEFAULTS = {"change-me-in-production", "secret", ""}


def _check_secrets() -> None:
    if AUTH_JWT_SECRET in INSECURE_JWT_DEFAULTS:
        logger.critical(
            "AUTH_JWT_SECRET is set to an insecure default value. "
            "Set a strong secret in your .env before running in production."
        )
        if os.getenv("NEXTSTAY_ENV", "development").lower() == "production":
            sys.exit(1)

    if DEV_OWNER_TOKEN_ENABLED:
        logger.warning(
            "DEV_OWNER_TOKEN_ENABLED=true — the dev bypass token is active. Never enable this in production."
        )


# ---------------------------------------------------------------------------
# Request-ID middleware
# ---------------------------------------------------------------------------


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("X-Request-ID") or new_request_id()
        token = request_id_var.set(rid)
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        request_id_var.reset(token)
        return response


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(title="NextStay API", version="1.0.0")

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Request ID tracing
app.add_middleware(RequestIdMiddleware)

# CORS — explicit allow-list, no wildcard
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(register_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(hotel_profile_router, prefix="/api/v1")
app.include_router(rooms_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")
app.include_router(bookings_router, prefix="/api/v1")
app.include_router(guest_router, prefix="/api/v1")
app.include_router(stripe_router, prefix="/api/v1")
app.include_router(pricing_lab_router, prefix="/api/v1")
app.include_router(training_router, prefix="/api/v1")
app.include_router(pricing_config_router, prefix="/api/v1")
app.include_router(pricing_pipeline_router, prefix="/api/v1")
app.include_router(inventory_setup_router, prefix="/api/v1")
app.include_router(holds_router, prefix="/api/v1")
app.include_router(staff_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")

register_exception_handlers(app)

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
(UPLOADS_DIR / "rooms").mkdir(parents=True, exist_ok=True)
app.mount("/api/v1/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.on_event("startup")
def startup() -> None:
    _check_secrets()
    prepare_database()
    logger.info("NextStay API started.")
