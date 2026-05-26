from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.adapters.persistence.models import PasswordResetTokenModel
from app.adapters.persistence.repositories import (
    PasswordResetTokenRepository,
    RefreshTokenRepository,
    UserRepository,
)
from app.application.auth.password_service import PasswordService
from app.application.auth.token_service import _hash_token
from app.domain.users.entities import UserRole


def _register_user(
    client: TestClient,
    email: str = "test@humber.ca",
    password: str = "Password1!",
    display_name: str = "Test User",
):
    return client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "display_name": display_name,
        },
    )


def test_register_returns_201_and_token(client: TestClient) -> None:
    response = _register_user(client)

    assert response.status_code == 201
    body = response.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["token_type"] == "bearer"


def test_register_assigns_regular_role_for_external_email(
    client: TestClient,
    db_session,
) -> None:
    response = _register_user(client, email="external@example.com")

    assert response.status_code == 201
    user = UserRepository(db_session).get_by_email("external@example.com")
    assert user is not None
    assert user.role is UserRole.REGULAR


def test_register_duplicate_email_returns_409(client: TestClient) -> None:
    _register_user(client)

    response = _register_user(client)

    assert response.status_code == 409
    assert response.json() == {"detail": "Email is already registered."}


def test_register_short_password_returns_422(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={
            "email": "short@humber.ca",
            "password": "short",
            "display_name": "User",
        },
    )

    assert response.status_code == 422


def test_register_blank_display_name_returns_422(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={
            "email": "blank-name@humber.ca",
            "password": "Password1!",
            "display_name": "   ",
        },
    )

    assert response.status_code == 422


def test_login_correct_credentials_returns_200(client: TestClient) -> None:
    _register_user(client, email="login@humber.ca", password="ValidPass1!")

    response = client.post(
        "/auth/login",
        json={"email": "login@humber.ca", "password": "ValidPass1!"},
    )

    assert response.status_code == 200
    assert response.json()["access_token"]


def test_login_wrong_password_returns_401(client: TestClient) -> None:
    _register_user(client, email="wrong-pass@humber.ca", password="ValidPass1!")

    response = client.post(
        "/auth/login",
        json={"email": "wrong-pass@humber.ca", "password": "WrongPass1!"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password."}


def test_login_user_without_password_hash_returns_401(
    client: TestClient,
    db_session,
) -> None:
    user_repo = UserRepository(db_session)
    user_repo.create_user(
        email="nopass@humber.ca",
        display_name="No Password",
        role=UserRole.STUDENT,
    )

    response = client.post(
        "/auth/login",
        json={"email": "nopass@humber.ca", "password": "anything"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password."}


def test_reset_request_always_returns_200_for_unknown_email(client: TestClient) -> None:
    response = client.post(
        "/auth/password/reset-request",
        json={"email": "missing@humber.ca"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "message": "If this email is registered, a reset token has been sent."
    }


def test_reset_request_sends_email_for_known_user(client: TestClient, app, db_session) -> None:
    _register_user(client, email="resetme@humber.ca")
    mock_service = MagicMock()

    from app.adapters.http.routers.auth import _get_email_service

    app.dependency_overrides[_get_email_service] = lambda: mock_service
    try:
        response = client.post(
            "/auth/password/reset-request",
            json={"email": "resetme@humber.ca"},
        )
    finally:
        app.dependency_overrides.pop(_get_email_service, None)

    assert response.status_code == 200
    mock_service.send_password_reset.assert_called_once()
    token_repo = PasswordResetTokenRepository(db_session)
    tokens = db_session.query(PasswordResetTokenModel).all()
    assert len(tokens) == 1
    assert token_repo.get_valid_by_hash(tokens[0].token_hash) is not None


def test_reset_verify_valid_token_returns_200(client: TestClient, db_session) -> None:
    _register_user(client, email="verify@humber.ca", password="OldPass1!")
    user_repo = UserRepository(db_session)
    user = user_repo.get_by_email("verify@humber.ca")
    assert user is not None

    reset_repo = PasswordResetTokenRepository(db_session)
    raw_token = PasswordService.create_reset_token(user.id, reset_repo)

    response = client.post(
        "/auth/password/reset-verify",
        json={"token": raw_token, "new_password": "NewPass1!"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Password updated successfully."}
    assert PasswordService.verify_password(
        "NewPass1!",
        user_repo.get_password_hash_for_email("verify@humber.ca") or "",
    )
    assert reset_repo.get_valid_by_hash(_hash_token(raw_token)) is None


def test_reset_verify_revokes_existing_refresh_tokens(
    client: TestClient,
    db_session,
) -> None:
    _register_user(client, email="refresh-reset@humber.ca", password="OldPass1!")
    user_repo = UserRepository(db_session)
    user = user_repo.get_by_email("refresh-reset@humber.ca")
    assert user is not None

    refresh_repo = RefreshTokenRepository(db_session)
    raw_refresh_token = "r" * 64
    refresh_repo.create(
        user_id=user.id,
        token_hash=_hash_token(raw_refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )

    reset_repo = PasswordResetTokenRepository(db_session)
    raw_token = PasswordService.create_reset_token(user.id, reset_repo)

    response = client.post(
        "/auth/password/reset-verify",
        json={"token": raw_token, "new_password": "NewPass1!"},
    )

    assert response.status_code == 200
    assert refresh_repo.get_valid_by_hash(_hash_token(raw_refresh_token)) is None


def test_reset_verify_invalid_token_returns_400(client: TestClient) -> None:
    response = client.post(
        "/auth/password/reset-verify",
        json={"token": "notarealtoken", "new_password": "NewPass1!"},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid or expired reset token."}
