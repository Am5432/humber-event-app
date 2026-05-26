from __future__ import annotations

from collections.abc import Callable, Generator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.adapters.auth.mock import MockAuthProvider
from app.adapters.auth.interfaces import AuthProvider
from app.bootstrap.app import create_app, get_auth_provider
from app.bootstrap.config import get_settings
from app.bootstrap.db import Base, get_engine, get_session, get_session_factory


def reset_runtime_caches() -> None:
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


@pytest.fixture
def database_url(tmp_path: Path) -> str:
    return f"sqlite:///{tmp_path / 'test.db'}"


@pytest.fixture
def app(database_url: str, monkeypatch: pytest.MonkeyPatch) -> Generator[FastAPI, None, None]:
    monkeypatch.setenv("EVENT_APP_DATABASE_URL", database_url)
    monkeypatch.setenv("EVENT_APP_AUTH_PROVIDER", "mock")
    reset_runtime_caches()

    application = create_app()
    Base.metadata.create_all(bind=application.state.engine)

    yield application

    application.dependency_overrides.clear()
    Base.metadata.drop_all(bind=application.state.engine)
    application.state.engine.dispose()
    reset_runtime_caches()


@pytest.fixture
def client(app: FastAPI) -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def override_session_dependency(app: FastAPI) -> Generator[
    Callable[[Callable[[], object]], None],
    None,
    None,
]:
    def apply_override(factory: Callable[[], object]) -> None:
        app.dependency_overrides[get_session] = factory

    yield apply_override
    app.dependency_overrides.pop(get_session, None)


@pytest.fixture
def override_auth_dependency(app: FastAPI) -> Generator[
    Callable[[AuthProvider], None],
    None,
    None,
]:
    def apply_override(provider: AuthProvider) -> None:
        app.dependency_overrides[get_auth_provider] = lambda: provider

    yield apply_override
    app.dependency_overrides.pop(get_auth_provider, None)


@pytest.fixture
def mock_auth_provider() -> MockAuthProvider:
    return MockAuthProvider()


@pytest.fixture
def db_session(app: FastAPI) -> Generator[Session, None, None]:
    session = app.state.session_factory()
    try:
        yield session
    finally:
        session.close()
