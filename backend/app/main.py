from app.api.v1.health import router as health_router
from app.exceptions import register_exception_handlers
from fastapi import FastAPI

app = FastAPI(title="Backend API", version="1.0.0")

app.include_router(health_router, prefix="/api/v1")

register_exception_handlers(app)
