from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.auth.interfaces import AuthProvider
from app.adapters.auth.jwt_provider import JWTAuthProvider
from app.adapters.auth.mock import MockAuthProvider
from app.adapters.media.storage import LocalEventImageStorage
from app.bootstrap.config import Settings, get_settings
from app.bootstrap.db import get_engine, get_session_factory


def build_auth_provider(settings: Settings) -> AuthProvider:
    if settings.auth_provider == "firebase":
        from app.adapters.auth.firebase import FirebaseAuthProvider

        return FirebaseAuthProvider(
            project_id=settings.firebase_project_id,
            service_account_json=settings.firebase_service_account_json,
        )
    if settings.auth_provider == "jwt":
        return JWTAuthProvider(
            jwt_secret=settings.jwt_secret,
            jwt_algorithm=settings.jwt_algorithm,
        )

    return MockAuthProvider()


def get_auth_provider(request: Request) -> AuthProvider:
    return request.app.state.auth_provider


def get_jwt_secret(request: Request) -> str:
    return request.app.state.jwt_secret


def get_jwt_algorithm(request: Request) -> str:
    return request.app.state.jwt_algorithm


def create_app(settings: Settings | None = None) -> FastAPI:
    from app.adapters.http.routers import (
        admin_events,
        admin_users,
        auth,
        categories,
        discovery,
        health,
        media,
        organizer_events,
        users,
    )

    resolved_settings = settings or get_settings()

    application = FastAPI(
        title=resolved_settings.app_name,
        docs_url="/",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.state.settings = resolved_settings
    application.state.engine = get_engine(resolved_settings.database_url)
    application.state.session_factory = get_session_factory(
        resolved_settings.database_url,
    )
    application.state.auth_provider = build_auth_provider(resolved_settings)
    application.state.jwt_secret = resolved_settings.jwt_secret
    application.state.jwt_algorithm = resolved_settings.jwt_algorithm
    application.state.media_storage = LocalEventImageStorage(
        resolved_settings.media_root,
        resolved_settings.media_url_prefix,
    )

    application.include_router(health.router)
    application.include_router(auth.router)
    application.include_router(users.router)
    application.include_router(categories.router)
    application.include_router(organizer_events.router)
    application.include_router(admin_events.router)
    application.include_router(admin_users.router)
    application.include_router(discovery.router)
    application.include_router(
        media.router,
        prefix=resolved_settings.media_url_prefix.rstrip("/"),
    )

    return application
