from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.adapters.persistence.models import PasswordResetTokenModel
from app.adapters.persistence.repositories import PasswordResetTokenRepository, UserRepository
from app.application.auth.password_service import PasswordService
from app.domain.users.entities import UserRole


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def test_hash_password_returns_bcrypt_string() -> None:
    result = PasswordService.hash_password("mysecret")
    assert result.startswith("$2b$")


def test_verify_password_correct_password() -> None:
    hashed = PasswordService.hash_password("mysecret")
    assert PasswordService.verify_password("mysecret", hashed) is True


def test_verify_password_wrong_password() -> None:
    hashed = PasswordService.hash_password("mysecret")
    assert PasswordService.verify_password("wrongpass", hashed) is False


def test_create_reset_token_returns_hex_and_persists_hash(db_session: Session) -> None:
    user_repo = UserRepository(db_session)
    user = user_repo.create_user(
        email="reset@humber.ca",
        display_name="Tester",
        role=UserRole.STUDENT,
    )
    reset_repo = PasswordResetTokenRepository(db_session)

    raw = PasswordService.create_reset_token(user.id, reset_repo)
    stored = reset_repo.get_valid_by_hash(_hash_token(raw))

    assert len(raw) == 64
    assert all(character in "0123456789abcdef" for character in raw)
    assert stored is not None
    assert stored.user_id == user.id


def test_validate_reset_token_returns_model_for_valid_token(db_session: Session) -> None:
    user_repo = UserRepository(db_session)
    user = user_repo.create_user(
        email="valid@humber.ca",
        display_name="Tester",
        role=UserRole.STUDENT,
    )
    reset_repo = PasswordResetTokenRepository(db_session)

    raw = PasswordService.create_reset_token(user.id, reset_repo)
    result = PasswordService.validate_reset_token(raw, reset_repo)

    assert result is not None
    assert result.user_id == user.id


def test_validate_reset_token_returns_none_for_invalid_states(
    db_session: Session,
) -> None:
    user_repo = UserRepository(db_session)
    user = user_repo.create_user(
        email="invalid@humber.ca",
        display_name="Tester",
        role=UserRole.STUDENT,
    )
    reset_repo = PasswordResetTokenRepository(db_session)

    raw = PasswordService.create_reset_token(user.id, reset_repo)
    reset_repo.mark_used(_hash_token(raw))
    expired = PasswordResetTokenModel(
        user_id=user.id,
        token_hash="f" * 64,
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
    )
    db_session.add(expired)
    db_session.commit()

    assert PasswordService.validate_reset_token("notarealtoken", reset_repo) is None
    assert PasswordService.validate_reset_token(raw, reset_repo) is None
    assert reset_repo.get_valid_by_hash("f" * 64) is None
