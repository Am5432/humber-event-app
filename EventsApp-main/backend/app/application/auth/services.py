from __future__ import annotations

import hashlib

from sqlalchemy.orm import Session

from app.adapters.persistence.repositories import (
    PasswordResetTokenRepository,
    RefreshTokenRepository,
    UserRepository,
)
from app.application.auth.dto import TokenPair
from app.application.auth.email_service import EmailService
from app.application.auth.password_service import PasswordService
from app.application.auth.token_service import TokenService
from app.domain.users import policies
from app.domain.users.entities import User


class AuthService:
    def __init__(
        self,
        *,
        session: Session,
        user_repo: UserRepository,
        refresh_repo: RefreshTokenRepository,
        password_reset_repo: PasswordResetTokenRepository,
        token_service: TokenService,
        email_service: EmailService | None = None,
    ) -> None:
        self._session = session
        self._user_repo = user_repo
        self._refresh_repo = refresh_repo
        self._password_reset_repo = password_reset_repo
        self._token_service = token_service
        self._email_service = email_service

    def register_user(
        self,
        *,
        email: str,
        display_name: str,
        password: str,
    ) -> TokenPair:
        normalized_email = email.strip().lower()
        existing = self._user_repo.get_by_email(normalized_email)
        if existing is not None:
            raise ValueError("Email is already registered.")

        user = self._user_repo.create_user(
            email=normalized_email,
            display_name=display_name,
            role=policies.derive_role_from_email(normalized_email),
        )
        self._user_repo.set_password_hash(
            user.id,
            PasswordService.hash_password(password),
        )
        return self._issue_tokens(user)

    def login_user(self, *, email: str, password: str) -> TokenPair:
        normalized_email = email.strip().lower()
        stored_hash = self._user_repo.get_password_hash_for_email(normalized_email)
        if stored_hash is None or not PasswordService.verify_password(
            password,
            stored_hash,
        ):
            raise ValueError("Invalid email or password.")

        user = self._user_repo.get_by_email(normalized_email)
        if user is None:
            raise ValueError("Invalid email or password.")

        return self._issue_tokens(user)

    def refresh_tokens(self, refresh_token: str) -> TokenPair:
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        existing = self._refresh_repo.get_valid_by_hash(token_hash)
        if existing is None:
            raise ValueError("Refresh token is invalid or expired.")

        user = self._user_repo.get_by_id(existing.user_id)
        if user is None:
            raise ValueError("User not found.")

        access_token, new_refresh = self._token_service.rotate_refresh_token(
            refresh_token,
            user,
        )
        return TokenPair(access_token=access_token, refresh_token=new_refresh)

    def logout(self, refresh_token: str) -> None:
        self._token_service.revoke_refresh_token(refresh_token)

    def request_password_reset(self, email: str) -> str:
        normalized_email = email.strip().lower()
        user = self._user_repo.get_by_email(normalized_email)
        if user is not None and self._email_service is not None:
            raw_token = PasswordService.create_reset_token(
                user.id,
                self._password_reset_repo,
            )
            self._email_service.send_password_reset(normalized_email, raw_token)

        return "If this email is registered, a reset token has been sent."

    def reset_password(self, *, token: str, new_password: str) -> str:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        token_model = self._password_reset_repo.consume_valid_by_hash(
            token_hash,
            commit=False,
        )
        if token_model is None:
            raise ValueError("Invalid or expired reset token.")

        try:
            new_hash = PasswordService.hash_password(new_password)
            self._user_repo.set_password_hash(
                token_model.user_id,
                new_hash,
                commit=False,
            )
            self._refresh_repo.revoke_all_for_user(
                token_model.user_id,
                commit=False,
            )
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise

        return "Password updated successfully."

    def _issue_tokens(self, user: User) -> TokenPair:
        return TokenPair(
            access_token=self._token_service.issue_access_token(user),
            refresh_token=self._token_service.issue_refresh_token(user.id),
        )
