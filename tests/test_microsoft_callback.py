from __future__ import annotations

from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app.adapters.persistence.models import UserModel
from app.adapters.persistence.repositories import UserRepository
from app.adapters.http.schemas.auth import MicrosoftCallbackSchema
from app.bootstrap.config import Settings, get_settings
from app.domain.users.entities import UserRole


CALLBACK_PATH = "/auth/microsoft/callback"


def _payload() -> dict[str, str]:
    return {
        "code": "auth-code",
        "redirect_uri": "humber-event-hub://auth/callback",
        "code_verifier": "x" * 43,
    }


def _configured_settings(app) -> Settings:
    return app.state.settings.model_copy(
        update={
            "azure_client_id": "azure-client-id",
            "azure_tenant_id": "azure-tenant-id",
            "azure_client_secret": "azure-client-secret",
        }
    )


def _missing_azure_settings(app) -> Settings:
    return app.state.settings.model_copy(
        update={
            "azure_client_id": None,
            "azure_tenant_id": None,
            "azure_client_secret": None,
        }
    )


def test_settings_include_azure_configuration_fields(monkeypatch) -> None:
    monkeypatch.delenv("EVENT_APP_AZURE_CLIENT_ID", raising=False)
    monkeypatch.delenv("EVENT_APP_AZURE_TENANT_ID", raising=False)
    monkeypatch.delenv("EVENT_APP_AZURE_CLIENT_SECRET", raising=False)
    settings = Settings(_env_file=None)

    assert settings.azure_client_id is None
    assert settings.azure_tenant_id is None
    assert settings.azure_client_secret is None


def test_microsoft_callback_schema_accepts_rfc7636_minimum_verifier() -> None:
    schema = MicrosoftCallbackSchema(
        code="auth-code",
        redirect_uri="humber-event-hub://auth/callback",
        code_verifier="x" * 43,
    )

    assert schema.code_verifier == "x" * 43


@pytest.mark.parametrize("length", [42, 129])
def test_microsoft_callback_schema_rejects_invalid_verifier_lengths(
    length: int,
) -> None:
    with pytest.raises(ValidationError):
        MicrosoftCallbackSchema(
            code="auth-code",
            redirect_uri="humber-event-hub://auth/callback",
            code_verifier="x" * length,
        )


def test_microsoft_callback_returns_503_when_azure_settings_are_missing(
    app, client
) -> None:
    app.dependency_overrides[get_settings] = lambda: _missing_azure_settings(app)
    response = client.post(CALLBACK_PATH, json=_payload())

    assert response.status_code == 503
    assert response.json() == {
        "detail": "Microsoft SSO is not configured on this server."
    }


def test_microsoft_callback_returns_401_when_token_exchange_fails(app, client) -> None:
    app.dependency_overrides[get_settings] = lambda: _configured_settings(app)
    token_response = Mock(status_code=401)
    token_response.json.return_value = {"error": "invalid_client"}

    with patch(
        "app.adapters.http.routers.auth.httpx.post",
        return_value=token_response,
    ) as post_mock:
        response = client.post(CALLBACK_PATH, json=_payload())

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Microsoft token exchange failed: invalid_client"
    }
    assert post_mock.call_args.kwargs["data"]["code_verifier"] == "x" * 43


def test_microsoft_callback_returns_401_when_graph_lookup_fails(app, client) -> None:
    app.dependency_overrides[get_settings] = lambda: _configured_settings(app)
    token_response = Mock(status_code=200)
    token_response.json.return_value = {"access_token": "microsoft-access-token"}
    graph_response = Mock(status_code=401)

    with patch(
        "app.adapters.http.routers.auth.httpx.post",
        return_value=token_response,
    ), patch(
        "app.adapters.http.routers.auth.httpx.get",
        return_value=graph_response,
    ):
        response = client.post(CALLBACK_PATH, json=_payload())

    assert response.status_code == 401
    assert response.json() == {"detail": "Failed to fetch Microsoft user profile."}


def test_microsoft_callback_returns_400_when_graph_profile_has_no_email(
    app, client
) -> None:
    app.dependency_overrides[get_settings] = lambda: _configured_settings(app)
    token_response = Mock(status_code=200)
    token_response.json.return_value = {"access_token": "microsoft-access-token"}
    graph_response = Mock(status_code=200)
    graph_response.json.return_value = {"displayName": "No Email"}

    with patch(
        "app.adapters.http.routers.auth.httpx.post",
        return_value=token_response,
    ), patch(
        "app.adapters.http.routers.auth.httpx.get",
        return_value=graph_response,
    ):
        response = client.post(CALLBACK_PATH, json=_payload())

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Could not determine email from Microsoft profile."
    }


def test_microsoft_callback_creates_student_for_humber_email(
    app, client, db_session
) -> None:
    app.dependency_overrides[get_settings] = lambda: _configured_settings(app)
    token_response = Mock(status_code=200)
    token_response.json.return_value = {"access_token": "microsoft-access-token"}
    graph_response = Mock(status_code=200)
    graph_response.json.return_value = {
        "id": "ms-graph-user-001",
        "mail": "new.student@humber.ca",
        "displayName": "New Student",
    }

    with patch(
        "app.adapters.http.routers.auth.httpx.post",
        return_value=token_response,
    ), patch(
        "app.adapters.http.routers.auth.httpx.get",
        return_value=graph_response,
    ) as get_mock:
        response = client.post(CALLBACK_PATH, json=_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["token_type"] == "bearer"
    assert get_mock.call_args.kwargs["headers"]["Authorization"] == (
        "Bearer microsoft-access-token"
    )

    repository = UserRepository(db_session)
    created_user = repository.get_by_email("new.student@humber.ca")
    assert created_user is not None
    assert created_user.display_name == "New Student"
    assert created_user.role == UserRole.STUDENT
    assert repository.get_by_identity("microsoft", "ms-graph-user-001") is not None


def test_microsoft_callback_creates_organizer_for_non_humber_email(
    app, client, db_session
) -> None:
    app.dependency_overrides[get_settings] = lambda: _configured_settings(app)
    token_response = Mock(status_code=200)
    token_response.json.return_value = {"access_token": "microsoft-access-token"}
    graph_response = Mock(status_code=200)
    graph_response.json.return_value = {
        "mail": "organizer@example.com",
        "displayName": "Event Organizer",
    }

    with patch(
        "app.adapters.http.routers.auth.httpx.post",
        return_value=token_response,
    ), patch(
        "app.adapters.http.routers.auth.httpx.get",
        return_value=graph_response,
    ):
        response = client.post(CALLBACK_PATH, json=_payload())

    assert response.status_code == 200

    repository = UserRepository(db_session)
    created_user = repository.get_by_email("organizer@example.com")
    assert created_user is not None
    assert created_user.role == UserRole.ORGANIZER


def test_microsoft_callback_uses_user_principal_name_when_mail_is_missing(
    app, client, db_session
) -> None:
    app.dependency_overrides[get_settings] = lambda: _configured_settings(app)
    token_response = Mock(status_code=200)
    token_response.json.return_value = {"access_token": "microsoft-access-token"}
    graph_response = Mock(status_code=200)
    graph_response.json.return_value = {
        "userPrincipalName": "principal@humber.ca",
        "displayName": "Principal User",
    }

    with patch(
        "app.adapters.http.routers.auth.httpx.post",
        return_value=token_response,
    ), patch(
        "app.adapters.http.routers.auth.httpx.get",
        return_value=graph_response,
    ):
        response = client.post(CALLBACK_PATH, json=_payload())

    assert response.status_code == 200

    repository = UserRepository(db_session)
    created_user = repository.get_by_email("principal@humber.ca")
    assert created_user is not None
    assert created_user.role == UserRole.STUDENT


def test_microsoft_callback_prefers_other_mails_for_guest_accounts(
    app, client, db_session
) -> None:
    app.dependency_overrides[get_settings] = lambda: _configured_settings(app)
    token_response = Mock(status_code=200)
    token_response.json.return_value = {"access_token": "microsoft-access-token"}
    graph_response = Mock(status_code=200)
    graph_response.json.return_value = {
        "userPrincipalName": "n01210458_gmail.com#EXT#@n01210458gmail.onmicrosoft.com",
        "otherMails": ["n01210458@gmail.com"],
        "displayName": "n01210458_gmail.com#EXT#",
    }

    with patch(
        "app.adapters.http.routers.auth.httpx.post",
        return_value=token_response,
    ), patch(
        "app.adapters.http.routers.auth.httpx.get",
        return_value=graph_response,
    ):
        response = client.post(CALLBACK_PATH, json=_payload())

    assert response.status_code == 200

    repository = UserRepository(db_session)
    created_user = repository.get_by_email("n01210458@gmail.com")
    assert created_user is not None
    assert (
        created_user.display_name == "n01210458"
    )
    assert created_user.role == UserRole.ORGANIZER


def test_microsoft_callback_reuses_existing_user_without_duplicates(
    app, client, db_session
) -> None:
    app.dependency_overrides[get_settings] = lambda: _configured_settings(app)
    repository = UserRepository(db_session)
    existing_user = repository.create_user(
        email="existing.organizer@example.com",
        display_name="Existing Organizer",
        role=UserRole.ORGANIZER,
    )
    token_response = Mock(status_code=200)
    token_response.json.return_value = {"access_token": "microsoft-access-token"}
    graph_response = Mock(status_code=200)
    graph_response.json.return_value = {
        "mail": existing_user.email,
        "displayName": "Updated Display Name",
    }

    with patch(
        "app.adapters.http.routers.auth.httpx.post",
        return_value=token_response,
    ), patch(
        "app.adapters.http.routers.auth.httpx.get",
        return_value=graph_response,
    ):
        response = client.post(CALLBACK_PATH, json=_payload())

    assert response.status_code == 200

    user_count = db_session.scalar(
        select(func.count()).select_from(UserModel).where(
            UserModel.email == existing_user.email
        )
    )
    assert user_count == 1

    persisted_user = repository.get_by_email(existing_user.email)
    assert persisted_user is not None
    assert persisted_user.id == existing_user.id
    assert persisted_user.display_name == "Existing Organizer"
