from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.health import router as health_router
from app.api.v1.rooms import router as rooms_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.bookings import router as bookings_router
from app.api.v1.auth import router as auth_router
from app.api.v1.guest import router as guest_router
from app.api.v1.stripe import router as stripe_router
from app.api.v1.reports import router as reports_router
from app.exceptions import register_exception_handlers
from app.db.base import Base
from app.db.session import engine
from app.models import AuthSession, Booking, CleaningTask, EmailOtp, GuestToken, Payment, Room, User  # table creation

# Create tables at startup
# TEMPORARILY DISABLED due to Docker issues - uncomment after fixing
# Base.metadata.create_all(bind=engine)

app = FastAPI(title="Backend API", version="1.0.0")

# CORS middleware - allow requests from frontend
# For development allow all origins (in production limit to specific domains)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",  # Fallback for development
    ],
    allow_credentials=False,  # Cannot use True with "*" in origins
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

# Connect all routers
app.include_router(health_router, prefix="/api/v1")
app.include_router(rooms_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")
app.include_router(bookings_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(guest_router, prefix="/api/v1")
app.include_router(stripe_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")

register_exception_handlers(app)
