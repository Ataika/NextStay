from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import OperationalError


<<<<<<< HEAD
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        """Handle HTTP exceptions (404, 400, etc.)"""
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "message": exc.detail}
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle validation errors"""
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": exc.errors(), "message": "Validation error"}
        )

    @app.exception_handler(OperationalError)
    async def database_connection_handler(request: Request, exc: OperationalError):
        """Handle database connection errors"""
        error_msg = str(exc.orig) if hasattr(exc, 'orig') else str(exc)
        if "Connection refused" in error_msg or "could not connect" in error_msg.lower():
            return JSONResponse(
                status_code=503,
                content={
                    "detail": "Database connection failed. Please ensure the database is running.",
                    "message": "Database unavailable",
                    "error": "Cannot connect to database. Check if PostgreSQL is running on localhost:5433"
                }
            )
        return JSONResponse(
            status_code=500,
            content={"detail": "Database error", "message": "Database error", "error": error_msg}
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        """Handle all other exceptions"""
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "message": "Internal server error"}
        )
=======
def register_exception_handlers(app):
    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
>>>>>>> dev
