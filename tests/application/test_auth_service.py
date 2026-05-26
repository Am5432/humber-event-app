import pytest

from app.adapters.auth.interfaces import VerifiedIdentity
from app.adapters.persistence.repositories import (
    PasswordResetTokenRepository,
    RefreshTokenRepository,
    UserRepository,
)
from app.application.auth.services import AuthService
from app.application.auth.token_service import TokenService
from app.application.users.services import UserService
from app.domain.users.entities import UserRole


def test_mock_auth_provider_returns_verified_identity_shape(
    db_session,
    mock_auth_provider,
) -> None:
    identity = mock_auth_provider.verify_token("dev-student-token")
    user_service = UserService(UserRepository(db_session))

    current_user = user_service.resolve_current_user(identity)

    assert isinstance(identity, VerifiedIdentity)
    assert current_user.email == "student@humber.ca"
    assert current_user.display_name == "Dev Student"
    assert current_user.role.value == "student"


def test_mock_auth_provider_rejects_invalid_tokens(mock_auth_provider) -> None:
    with pytest.raises(ValueError):
        mock_auth_provider.verify_token("invalid-token")


def test_auth_service_register_assigns_regular_role_for_external_email(
    db_session,
) -> None:
    auth_service = AuthService(
        session=db_session,
        user_repo=UserRepository(db_session),
        refresh_repo=RefreshTokenRepository(db_session),
        password_reset_repo=PasswordResetTokenRepository(db_session),
        token_service=TokenService(
            refresh_repo=RefreshTokenRepository(db_session),
            jwt_secret="test-secret",
        ),
    )

    tokens = auth_service.register_user(
        email="external@example.com",
        display_name="External User",
        password="Password1!",
    )

    user = UserRepository(db_session).get_by_email("external@example.com")
    assert user is not None
    assert user.role is UserRole.REGULAR
    assert tokens.access_token
    assert tokens.refresh_token


def test_auth_service_register_assigns_organizer_role_for_demo_organizer_email(
    db_session,
) -> None:
    auth_service = AuthService(
        session=db_session,
        user_repo=UserRepository(db_session),
        refresh_repo=RefreshTokenRepository(db_session),
        password_reset_repo=PasswordResetTokenRepository(db_session),
        token_service=TokenService(
            refresh_repo=RefreshTokenRepository(db_session),
            jwt_secret="test-secret",
        ),
    )

    tokens = auth_service.register_user(
        email="n01210458@gmail.com",
        display_name="N01210458",
        password="Password1!",
    )

    user = UserRepository(db_session).get_by_email("n01210458@gmail.com")
    assert user is not None
    assert user.role is UserRole.ORGANIZER
    assert tokens.access_token
    assert tokens.refresh_token
