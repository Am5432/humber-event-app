from __future__ import annotations

import pytest

from app.bootstrap.app import build_auth_provider
from app.bootstrap.config import Settings


def test_firebase_provider_raises_import_error_when_package_absent() -> None:
    """Lazy Firebase loading should fail only when explicitly requested."""
    settings = Settings(auth_provider="firebase")

    with pytest.raises(ImportError):
        build_auth_provider(settings)


def test_default_auth_provider_is_jwt() -> None:
    """JWT is the secure default auth provider after Firebase removal."""
    settings = Settings()

    assert settings.auth_provider == "jwt"
