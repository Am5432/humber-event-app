from __future__ import annotations

from unittest.mock import patch

import pytest
from pydantic import ValidationError

from app.bootstrap.config import Settings


def test_settings_include_resend_api_key_field(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EVENT_APP_RESEND_API_KEY", raising=False)

    settings = Settings(_env_file=None)

    assert settings.resend_api_key is None


def test_register_schema_validates_email_password_and_display_name() -> None:
    from app.adapters.http.schemas.auth import RegisterSchema

    schema = RegisterSchema(
        email="student@humber.ca",
        password="Password1!",
        display_name="Student User",
    )

    assert str(schema.email) == "student@humber.ca"
    assert schema.password == "Password1!"
    assert schema.display_name == "Student User"


def test_register_schema_rejects_blank_display_name() -> None:
    from app.adapters.http.schemas.auth import RegisterSchema

    with pytest.raises(ValidationError):
        RegisterSchema(
            email="student@humber.ca",
            password="Password1!",
            display_name="   ",
        )


def test_login_schema_requires_email_and_password() -> None:
    from app.adapters.http.schemas.auth import LoginSchema

    schema = LoginSchema(email="student@humber.ca", password="Password1!")

    assert str(schema.email) == "student@humber.ca"
    assert schema.password == "Password1!"


def test_password_reset_request_schema_requires_email() -> None:
    from app.adapters.http.schemas.auth import PasswordResetRequestSchema

    schema = PasswordResetRequestSchema(email="student@humber.ca")

    assert str(schema.email) == "student@humber.ca"


def test_password_reset_verify_schema_requires_token_and_min_password_length() -> None:
    from app.adapters.http.schemas.auth import PasswordResetVerifySchema

    schema = PasswordResetVerifySchema(token="rawtoken123", new_password="Password1!")

    assert schema.token == "rawtoken123"
    assert schema.new_password == "Password1!"


def test_email_service_send_password_reset_calls_resend_sdk() -> None:
    from app.application.auth.email_service import EmailService

    service = EmailService(api_key="resend-api-key")

    with patch("app.application.auth.email_service.resend.Emails.send") as send_mock:
        service.send_password_reset("user@humber.ca", "rawtoken123")

    send_mock.assert_called_once()
    payload = send_mock.call_args.args[0]
    assert payload["to"] == ["user@humber.ca"]
    assert payload["subject"] == "Your Humber Event Hub password reset code"
    assert "rawtoken123" in payload["text"]


@pytest.mark.parametrize(
    ("schema_name", "payload"),
    [
        (
            "RegisterSchema",
            {"email": "invalid-email", "password": "Password1!", "display_name": "User"},
        ),
        ("RegisterSchema", {"email": "user@humber.ca", "password": "short", "display_name": "User"}),
        ("RegisterSchema", {"email": "user@humber.ca", "password": "Password1!", "display_name": ""}),
        ("RegisterSchema", {"email": "user@humber.ca", "password": "Password1!", "display_name": "   "}),
        ("LoginSchema", {"email": "invalid-email", "password": "Password1!"}),
        ("LoginSchema", {"email": "user@humber.ca", "password": ""}),
        ("PasswordResetRequestSchema", {"email": "invalid-email"}),
        ("PasswordResetVerifySchema", {"token": "", "new_password": "Password1!"}),
        ("PasswordResetVerifySchema", {"token": "rawtoken123", "new_password": "short"}),
    ],
)
def test_email_auth_schemas_reject_invalid_values(
    schema_name: str,
    payload: dict[str, str],
) -> None:
    from app.adapters.http import schemas as schema_package

    schema_cls = getattr(schema_package.auth, schema_name)

    with pytest.raises(ValidationError):
        schema_cls(**payload)
