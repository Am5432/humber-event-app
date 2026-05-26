from __future__ import annotations
from pydantic import BaseModel, Field, field_validator, EmailStr


class TokenResponse(BaseModel):
    """Response for /auth/otp/verify and /auth/refresh."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshSchema(BaseModel):
    """Body for POST /auth/refresh."""

    refresh_token: str = Field(..., min_length=1)


class LogoutSchema(BaseModel):
    """Body for POST /auth/logout."""

    refresh_token: str = Field(..., min_length=1)


class MicrosoftCallbackSchema(BaseModel):
    """Body for POST /auth/microsoft/callback."""

    code: str = Field(..., min_length=1)
    redirect_uri: str = Field(..., min_length=1)
    code_verifier: str = Field(..., min_length=43, max_length=128)


class RegisterSchema(BaseModel):
    """Body for POST /auth/register."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    display_name: str = Field(..., min_length=1, max_length=255)

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("display_name must not be blank")
        return normalized


class LoginSchema(BaseModel):
    """Body for POST /auth/login."""

    email: EmailStr
    password: str = Field(..., min_length=4)


class PasswordResetRequestSchema(BaseModel):
    """Body for POST /auth/password/reset-request."""

    email: EmailStr


class PasswordResetVerifySchema(BaseModel):
    """Body for POST /auth/password/reset-verify."""

    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
