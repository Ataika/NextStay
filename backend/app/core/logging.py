import logging
import sys
import uuid
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get("-")
        return True


def configure_logging() -> None:
    fmt = "%(asctime)s [%(levelname)s] [%(request_id)s] %(name)s: %(message)s"
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())
    logging.basicConfig(level=logging.INFO, format=fmt, handlers=[handler])
    # Silence overly verbose third-party loggers
    for noisy in ("uvicorn.access", "stripe"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.addFilter(RequestIdFilter())
    return logger


def new_request_id() -> str:
    return uuid.uuid4().hex[:12]
