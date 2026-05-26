from __future__ import annotations

from pathlib import Path
import os
import logging

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
import uvicorn

from app.bootstrap.app import create_app
from app.bootstrap.logging_config import configure_logging


configure_logging()
app: FastAPI = create_app()
logger = logging.getLogger(__name__)


def _alembic_config() -> Config:
    config = Config(str(Path(__file__).with_name("alembic.ini")))
    config.set_main_option("script_location", "app/adapters/persistence/migrations")
    return config


def run_migrations() -> None:
    command.upgrade(_alembic_config(), "head")


def run() -> None:
    run_migrations()
    host = os.getenv("EVENT_APP_HOST", "0.0.0.0")
    port = int(os.getenv("EVENT_APP_PORT", "9000"))
    logger.info("Starting Humber Event Hub backend on %s:%s", host, port)
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=os.getenv("EVENT_APP_RELOAD", "true").lower() == "true",
    )


if __name__ == "__main__":
    run()
