from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "Humber Event Hub"
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'event_hub.db').as_posix()}"
    auth_provider: str = "jwt"
    media_root: Path = BACKEND_DIR / "media"
    media_url_prefix: str = "/media"
    max_event_image_bytes: int = 8_388_608
    max_event_images_per_event: int = 10
    firebase_project_id: str | None = None
    firebase_service_account_json: str | None = None
    azure_client_id: str | None = None
    azure_tenant_id: str | None = None
    azure_client_secret: str | None = None
    resend_api_key: str | None = None
    google_application_credentials: str | None = Field(default=None)
    jwt_secret: str = "dev-secret-change-in-prod"
    jwt_algorithm: str = "HS256"

    model_config = SettingsConfigDict(
        env_prefix="EVENT_APP_",
        env_file=BACKEND_DIR / ".env",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
