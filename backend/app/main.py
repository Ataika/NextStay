from app.api.v1.auth import router as auth_router
from app.api.v1.bookings import router as bookings_router
from app.api.v1.guest import router as guest_router
from app.api.v1.health import router as health_router
from app.api.v1.holds import router as holds_router
from app.api.v1.inventory_setup import router as inventory_setup_router
from app.api.v1.pricing_config import router as pricing_config_router
from app.api.v1.pricing_lab import router as pricing_lab_router
from app.api.v1.pricing_pipeline import router as pricing_pipeline_router
from app.api.v1.rooms import router as rooms_router
from app.api.v1.staff import router as staff_router
from app.api.v1.stripe import router as stripe_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.training import router as training_router
from app.exceptions import register_exception_handlers
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
)

# Connect all routers
app.include_router(health_router, prefix="/api/v1")
app.include_router(rooms_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")
app.include_router(bookings_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(guest_router, prefix="/api/v1")
app.include_router(stripe_router, prefix="/api/v1")
app.include_router(pricing_lab_router, prefix="/api/v1")
app.include_router(training_router, prefix="/api/v1")
app.include_router(pricing_config_router, prefix="/api/v1")
app.include_router(pricing_pipeline_router, prefix="/api/v1")
app.include_router(inventory_setup_router, prefix="/api/v1")
app.include_router(holds_router, prefix="/api/v1")
app.include_router(staff_router, prefix="/api/v1")

register_exception_handlers(app)
