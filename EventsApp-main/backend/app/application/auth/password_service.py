from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt

from app.adapters.persistence.models import PasswordResetTokenModel
from app.adapters.persistence.repositories import PasswordResetTokenRepository


RESET_TOKEN_EXPIRY_MINUTES = 10


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


class PasswordService:
    @staticmethod
    def hash_password(plain: str) -> str:
        return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        try:
            return bcrypt.checkpw(plain.encode(), hashed.encode())
        except ValueError:
            return False

    @staticmethod
    def create_reset_token(
        user_id: int,
        reset_repo: PasswordResetTokenRepository,
    ) -> str:
        raw = secrets.token_hex(32)
        reset_repo.create(
            user_id=user_id,
            token_hash=_hash_token(raw),
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=RESET_TOKEN_EXPIRY_MINUTES),
        )
        return raw

    @staticmethod
    def validate_reset_token(
        raw: str,
        reset_repo: PasswordResetTokenRepository,
    ) -> PasswordResetTokenModel | None:
        return reset_repo.get_valid_by_hash(_hash_token(raw))
