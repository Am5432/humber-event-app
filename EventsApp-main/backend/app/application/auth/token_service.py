from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.adapters.persistence.repositories import RefreshTokenRepository
from app.domain.users.entities import User


ACCESS_TOKEN_EXPIRY_MINUTES = 10
REFRESH_TOKEN_EXPIRY_DAYS = 30


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


class TokenService:
    def __init__(
        self,
        refresh_repo: RefreshTokenRepository,
        jwt_secret: str,
        jwt_algorithm: str = "HS256",
    ) -> None:
        self._refresh_repo = refresh_repo
        self._jwt_secret = jwt_secret
        self._jwt_algorithm = jwt_algorithm

    def issue_access_token(self, user: User) -> str:
        """Issue a signed access token containing the user's role."""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": user.email,
            "role": user.role.value,
            "jti": secrets.token_hex(8),
            "iat": int(now.timestamp()),
            "exp": int(
                (now + timedelta(minutes=ACCESS_TOKEN_EXPIRY_MINUTES)).timestamp()
            ),
        }
        return jwt.encode(payload, self._jwt_secret, algorithm=self._jwt_algorithm)

    def issue_refresh_token(self, user_id: int) -> str:
        """Generate a new opaque refresh token and persist its hash."""
        raw = secrets.token_hex(32)
        self._refresh_repo.create(
            user_id=user_id,
            token_hash=_hash_token(raw),
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=REFRESH_TOKEN_EXPIRY_DAYS),
        )
        return raw

    def rotate_refresh_token(self, old_raw_token: str, user: User) -> tuple[str, str]:
        """Revoke an existing refresh token and return a new token pair."""
        old_hash = _hash_token(old_raw_token)
        existing = self._refresh_repo.get_valid_by_hash(old_hash)
        if existing is None:
            raise ValueError("Refresh token is invalid or expired.")

        self._refresh_repo.revoke(old_hash)
        return self.issue_access_token(user), self.issue_refresh_token(user.id)

    def revoke_refresh_token(self, raw_token: str) -> None:
        """Revoke a refresh token without exposing whether it existed."""
        self._refresh_repo.revoke(_hash_token(raw_token))
