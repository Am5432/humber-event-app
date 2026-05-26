from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.adapters.http.dependencies import get_current_user, require_roles
from app.adapters.http.schemas.auth import (
    LoginSchema,
    LogoutSchema,
    MicrosoftCallbackSchema,
    PasswordResetRequestSchema,
    PasswordResetVerifySchema,
    RefreshSchema,
    RegisterSchema,
    TokenResponse,
)
from app.adapters.persistence.repositories import (
    PasswordResetTokenRepository,
    RefreshTokenRepository,
    UserRepository,
)
from app.application.auth.dto import TokenPair
from app.application.auth.email_service import EmailService
from app.application.auth.services import AuthService
from app.application.auth.token_service import TokenService
from app.application.users.dto import CurrentUserResponse
from app.bootstrap.app import get_jwt_algorithm, get_jwt_secret
from app.bootstrap.config import Settings, get_settings
from app.bootstrap.db import get_session
from app.domain.users import policies
from app.domain.users.entities import UserRole


router = APIRouter(tags=["auth"])
logger = logging.getLogger(__name__)


def _extract_email(profile: dict) -> str:
    mail = (profile.get("mail") or "").strip().lower()
    if mail:
        return mail

    other_mails = profile.get("otherMails") or []
    if isinstance(other_mails, list):
        for candidate in other_mails:
            normalized = str(candidate).strip().lower()
            if normalized:
                return normalized

    return str(profile.get("userPrincipalName") or "").strip().lower()


def _extract_display_name(profile: dict, email: str) -> str:
    display_name = str(profile.get("displayName") or "").strip()
    if display_name and "#EXT#" not in display_name.upper():
        return display_name

    given_name = str(profile.get("givenName") or "").strip()
    surname = str(profile.get("surname") or "").strip()
    combined = " ".join(part for part in [given_name, surname] if part)
    if combined:
        return combined

    return email.split("@")[0]


def _get_token_service(
    session: Session = Depends(get_session),
    jwt_secret: str = Depends(get_jwt_secret),
    jwt_algorithm: str = Depends(get_jwt_algorithm),
) -> TokenService:
    return TokenService(
        refresh_repo=RefreshTokenRepository(session),
        jwt_secret=jwt_secret,
        jwt_algorithm=jwt_algorithm,
    )


def _get_email_service(
    settings: Settings = Depends(get_settings),
) -> EmailService | None:
    logger.debug("Resolving email service with resend_api_key=%s", bool(settings.resend_api_key))
    if not settings.resend_api_key:
        return None
    return EmailService(api_key=settings.resend_api_key)


def _get_auth_service(
    session: Session = Depends(get_session),
    token_service: TokenService = Depends(_get_token_service),
    email_service: EmailService | None = Depends(_get_email_service),
) -> AuthService:
    return AuthService(
        session=session,
        user_repo=UserRepository(session),
        refresh_repo=RefreshTokenRepository(session),
        password_reset_repo=PasswordResetTokenRepository(session),
        token_service=token_service,
        email_service=email_service,
    )


def _to_token_response(tokens: TokenPair) -> TokenResponse:
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
    )


@router.get("/auth/me", response_model=CurrentUserResponse)
def read_current_user(
    current_user: CurrentUserResponse = Depends(get_current_user),
) -> CurrentUserResponse:
    return current_user


@router.get("/auth/admin-check")
def admin_check(
    current_user: CurrentUserResponse = Depends(require_roles("admin")),
) -> dict[str, str]:
    return {"status": "ok", "role": current_user.role.value}


@router.post("/auth/refresh", response_model=TokenResponse)
def refresh(
    body: RefreshSchema,
    auth_service: AuthService = Depends(_get_auth_service),
) -> TokenResponse:
    logger.info("Refresh token request received")
    try:
        tokens = auth_service.refresh_tokens(body.refresh_token)
    except ValueError as exc:
        logger.warning("Refresh token rotation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    return _to_token_response(tokens)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    body: LogoutSchema,
    auth_service: AuthService = Depends(_get_auth_service),
) -> Response:
    logger.info("Logout request received")
    auth_service.logout(body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/auth/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    body: RegisterSchema,
    auth_service: AuthService = Depends(_get_auth_service),
) -> TokenResponse:
    try:
        tokens = auth_service.register_user(
            email=str(body.email),
            display_name=body.display_name,
            password=body.password,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return _to_token_response(tokens)


@router.post("/auth/login", response_model=TokenResponse)
def login(
    body: LoginSchema,
    auth_service: AuthService = Depends(_get_auth_service),
) -> TokenResponse:
    email = str(body.email)
    logger.info("Password login attempt for email=%s", email)

    try:
        tokens = auth_service.login_user(email=email, password=body.password)
    except ValueError as exc:
        logger.warning("Password login rejected for email=%s", email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    logger.info("Password login succeeded for email=%s", email)
    return _to_token_response(tokens)


@router.post("/auth/password/reset-request", status_code=status.HTTP_200_OK)
def password_reset_request(
    body: PasswordResetRequestSchema,
    auth_service: AuthService = Depends(_get_auth_service),
) -> dict[str, str]:
    message = auth_service.request_password_reset(str(body.email))
    return {"message": message}


@router.post("/auth/password/reset-verify", status_code=status.HTTP_200_OK)
def password_reset_verify(
    body: PasswordResetVerifySchema,
    auth_service: AuthService = Depends(_get_auth_service),
) -> dict[str, str]:
    try:
        message = auth_service.reset_password(
            token=body.token,
            new_password=body.new_password,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return {"message": message}


@router.post("/auth/microsoft/callback", response_model=TokenResponse)
def microsoft_callback(
    body: MicrosoftCallbackSchema,
    session: Session = Depends(get_session),
    token_service: TokenService = Depends(_get_token_service),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    logger.info(
        "Microsoft callback started redirect_uri=%s verifier_length=%s",
        body.redirect_uri,
        len(body.code_verifier),
    )
    if not settings.azure_client_id or not settings.azure_tenant_id:
        logger.warning("Microsoft callback rejected because Azure SSO is not configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Microsoft SSO is not configured on this server.",
        )

    token_request_data = {
        "grant_type": "authorization_code",
        "client_id": settings.azure_client_id,
        "code": body.code,
        "redirect_uri": body.redirect_uri,
        "code_verifier": body.code_verifier,
        "scope": "openid profile email User.Read",
    }

    token_resp = httpx.post(
        f"https://login.microsoftonline.com/{settings.azure_tenant_id}/oauth2/v2.0/token",
        data=token_request_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10.0,
    )
    if token_resp.status_code != 200:
        try:
            error_payload = token_resp.json()
        except ValueError:
            error_payload = {"raw": token_resp.text[:500]}

        logger.warning(
            "Microsoft token exchange failed: status=%s payload=%s",
            token_resp.status_code,
            error_payload,
        )

        error_description = error_payload.get("error_description") or error_payload.get("error")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Microsoft token exchange failed."
                if not error_description
                else f"Microsoft token exchange failed: {error_description}"
            ),
        )

    logger.info("Microsoft token exchange succeeded")
    ms_access_token = token_resp.json()["access_token"]
    me_resp = httpx.get(
        "https://graph.microsoft.com/v1.0/me"
        "?$select=displayName,givenName,surname,mail,userPrincipalName,otherMails",
        headers={"Authorization": f"Bearer {ms_access_token}"},
        timeout=10.0,
    )
    if me_resp.status_code != 200:
        try:
            graph_error_payload = me_resp.json()
        except ValueError:
            graph_error_payload = {"raw": me_resp.text[:500]}

        logger.warning(
            "Microsoft Graph lookup failed: status=%s payload=%s",
            me_resp.status_code,
            graph_error_payload,
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to fetch Microsoft user profile.",
        )

    me = me_resp.json()
    provider_subject = str(me.get("id") or "").strip()
    email = _extract_email(me)
    if not email:
        logger.warning("Microsoft callback failed because no email could be extracted from Graph profile")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not determine email from Microsoft profile.",
        )
    display_name = _extract_display_name(me, email)
    logger.info(
        "Microsoft Graph profile resolved email=%s provider_subject_present=%s",
        email,
        bool(provider_subject),
    )

    user_repo = UserRepository(session)
    user = (
        user_repo.get_by_identity("microsoft", provider_subject)
        if provider_subject
        else None
    )
    if user is None:
        user = user_repo.get_by_email(email)
    if user is None:
        role = (
            UserRole.STUDENT
            if policies.is_student_email(email)
            else UserRole.ORGANIZER
        )
        user = user_repo.create_user(
            email=email,
            display_name=display_name,
            role=role,
        )
        logger.info(
            "Microsoft callback created user email=%s user_id=%s role=%s",
            email,
            user.id,
            user.role.value,
        )
    else:
        logger.info(
            "Microsoft callback matched existing user email=%s user_id=%s",
            email,
            user.id,
        )
    if provider_subject:
        user_repo.link_identity(
            user_id=user.id,
            provider="microsoft",
            provider_subject=provider_subject,
        )
        logger.info(
            "Microsoft identity linked for user_id=%s provider_subject=%s",
            user.id,
            provider_subject,
        )

    access_token = token_service.issue_access_token(user)
    refresh_token = token_service.issue_refresh_token(user.id)
    logger.info("Microsoft callback issued tokens for user_id=%s", user.id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )
