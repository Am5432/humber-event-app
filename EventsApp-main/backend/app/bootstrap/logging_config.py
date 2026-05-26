from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[2]
LOG_DIR = BACKEND_DIR / "logs"
APP_LOG_PATH = LOG_DIR / "app.log"
AUTH_LOG_PATH = LOG_DIR / "auth.log"
LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


def _has_handler(logger: logging.Logger, log_path: Path) -> bool:
    resolved_path = str(log_path.resolve())
    return any(
        isinstance(handler, RotatingFileHandler)
        and getattr(handler, "baseFilename", None) == resolved_path
        for handler in logger.handlers
    )


def _build_handler(log_path: Path) -> RotatingFileHandler:
    handler = RotatingFileHandler(
        log_path,
        maxBytes=1_000_000,
        backupCount=5,
        encoding="utf-8",
    )
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    return handler


def configure_logging() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    if not _has_handler(root_logger, APP_LOG_PATH):
        root_logger.addHandler(_build_handler(APP_LOG_PATH))

    auth_logger = logging.getLogger("app.adapters.http.routers.auth")
    auth_logger.setLevel(logging.INFO)

    if not _has_handler(auth_logger, AUTH_LOG_PATH):
        auth_logger.addHandler(_build_handler(AUTH_LOG_PATH))
