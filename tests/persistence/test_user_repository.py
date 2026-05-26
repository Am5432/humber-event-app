from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.auth.interfaces import VerifiedIdentity
from app.adapters.persistence.models import PasswordResetTokenModel, UserModel
from app.adapters.persistence.repositories import PasswordResetTokenRepository, UserRepository
from app.application.users.services import UserService
from app.domain.users.entities import UserRole


def test_resolve_current_user_auto_provisions_student_role(app) -> None:
    session: Session = app.state.session_factory()
    try:
        repository = UserRepository(session)
        user_service = UserService(repository)

        current_user = user_service.resolve_current_user(
            VerifiedIdentity(
                provider="mock",
                external_uid="firebase-student-001",
                email="student.one@humber.ca",
                display_name="Student One",
            ),
        )

        assert current_user.email == "student.one@humber.ca"
        assert current_user.display_name == "Student One"
        assert current_user.role == UserRole.STUDENT
    finally:
        session.close()


def test_resolve_current_user_auto_provisions_organizer_role(app) -> None:
    session: Session = app.state.session_factory()
    try:
        repository = UserRepository(session)
        user_service = UserService(repository)

        current_user = user_service.resolve_current_user(
            VerifiedIdentity(
                provider="mock",
                external_uid="firebase-organizer-001",
                email="organizer.one@humber.ca",
                display_name="Organizer One",
                role="organizer",
            ),
        )

        assert current_user.email == "organizer.one@humber.ca"
        assert current_user.role == UserRole.ORGANIZER
    finally:
        session.close()


def test_resolve_current_user_auto_provisions_admin_role(app) -> None:
    session: Session = app.state.session_factory()
    try:
        repository = UserRepository(session)
        user_service = UserService(repository)

        current_user = user_service.resolve_current_user(
            VerifiedIdentity(
                provider="mock",
                external_uid="firebase-admin-001",
                email="admin.one@humber.ca",
                display_name="Admin One",
                role="admin",
            ),
        )

        assert current_user.email == "admin.one@humber.ca"
        assert current_user.role == UserRole.ADMIN
    finally:
        session.close()


def test_repository_supports_email_lookup(app) -> None:
    session: Session = app.state.session_factory()
    try:
        repository = UserRepository(session)
        created_user = repository.create_user(
            email="organizer.one@humber.ca",
            display_name="Organizer One",
            role=UserRole.ORGANIZER,
        )

        by_email = repository.get_by_email("organizer.one@humber.ca")

        assert by_email is not None
        assert by_email.id == created_user.id
    finally:
        session.close()


def test_repository_updates_display_name(app) -> None:
    session: Session = app.state.session_factory()
    try:
        repository = UserRepository(session)
        created_user = repository.create_user(
            email="admin.one@humber.ca",
            display_name="Admin One",
            role=UserRole.ADMIN,
        )

        updated_user = repository.update_display_name(
            created_user.id,
            "Admin One Updated",
        )

        assert updated_user.display_name == "Admin One Updated"
        assert repository.get_by_email("admin.one@humber.ca").display_name == (
            "Admin One Updated"
        )
    finally:
        session.close()


def test_repository_supports_identity_lookup(app) -> None:
    session: Session = app.state.session_factory()
    try:
        repository = UserRepository(session)
        created_user = repository.create_user(
            email="identity.user@humber.ca",
            display_name="Identity User",
            role=UserRole.STUDENT,
        )
        repository.link_identity(
            user_id=created_user.id,
            provider="microsoft",
            provider_subject="graph-user-123",
        )

        by_identity = repository.get_by_identity("microsoft", "graph-user-123")

        assert by_identity is not None
        assert by_identity.id == created_user.id
    finally:
        session.close()


def test_user_service_links_same_email_across_different_providers(app) -> None:
    session: Session = app.state.session_factory()
    try:
        repository = UserRepository(session)
        user_service = UserService(repository)

        first_user = user_service.resolve_current_user(
            VerifiedIdentity(
                provider="microsoft",
                external_uid="ms-user-001",
                email="same.user@gmail.com",
                display_name="Same User",
            ),
        )

        second_user = user_service.resolve_current_user(
            VerifiedIdentity(
                provider="google",
                external_uid="google-user-001",
                email="same.user@gmail.com",
                display_name="Same User",
            ),
        )

        assert first_user.id == second_user.id
        assert repository.get_by_identity("microsoft", "ms-user-001") is not None
        assert repository.get_by_identity("google", "google-user-001") is not None
    finally:
        session.close()


def test_user_model_password_hash_is_nullable(app) -> None:
    session: Session = app.state.session_factory()
    try:
        model = UserModel(
            email="nullable.hash@humber.ca",
            display_name="Nullable Hash",
            role=UserRole.STUDENT.value,
            password_hash=None,
        )

        session.add(model)
        session.commit()
        session.refresh(model)

        assert model.password_hash is None
    finally:
        session.close()


def test_password_reset_token_model_has_expected_columns() -> None:
    columns = PasswordResetTokenModel.__table__.columns

    assert set(columns.keys()) == {
        "id",
        "user_id",
        "token_hash",
        "expires_at",
        "used_at",
        "created_at",
    }


def test_repository_sets_password_hash(app) -> None:
    session: Session = app.state.session_factory()
    try:
        repository = UserRepository(session)
        created_user = repository.create_user(
            email="password.setter@humber.ca",
            display_name="Password Setter",
            role=UserRole.STUDENT,
        )

        repository.set_password_hash(created_user.id, "hashed-password")

        stored_model = session.scalar(
            select(UserModel).where(UserModel.id == created_user.id)
        )
        assert stored_model is not None
        assert stored_model.password_hash == "hashed-password"
    finally:
        session.close()


def test_repository_gets_password_hash_for_email(app) -> None:
    session: Session = app.state.session_factory()
    try:
        repository = UserRepository(session)
        created_user = repository.create_user(
            email="password.lookup@humber.ca",
            display_name="Password Lookup",
            role=UserRole.STUDENT,
        )
        repository.set_password_hash(created_user.id, "stored-hash")

        assert repository.get_password_hash_for_email("password.lookup@humber.ca") == (
            "stored-hash"
        )
        assert repository.get_password_hash_for_email("missing@humber.ca") is None
    finally:
        session.close()


def test_password_reset_token_repository_creates_rows(app) -> None:
    session: Session = app.state.session_factory()
    try:
        user_repository = UserRepository(session)
        reset_repository = PasswordResetTokenRepository(session)
        user = user_repository.create_user(
            email="reset.create@humber.ca",
            display_name="Reset Create",
            role=UserRole.STUDENT,
        )

        reset_repository.create(
            user_id=user.id,
            token_hash="a" * 64,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )

        stored_model = session.scalar(
            select(PasswordResetTokenModel).where(
                PasswordResetTokenModel.user_id == user.id
            )
        )
        assert stored_model is not None
        assert stored_model.token_hash == "a" * 64
    finally:
        session.close()


def test_password_reset_token_repository_ignores_expired_or_used_tokens(app) -> None:
    session: Session = app.state.session_factory()
    try:
        user_repository = UserRepository(session)
        reset_repository = PasswordResetTokenRepository(session)
        user = user_repository.create_user(
            email="reset.invalid@humber.ca",
            display_name="Reset Invalid",
            role=UserRole.STUDENT,
        )

        expired = PasswordResetTokenModel(
            user_id=user.id,
            token_hash="b" * 64,
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
        used = PasswordResetTokenModel(
            user_id=user.id,
            token_hash="c" * 64,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
            used_at=datetime.now(timezone.utc),
        )
        session.add_all([expired, used])
        session.commit()

        assert reset_repository.get_valid_by_hash("b" * 64) is None
        assert reset_repository.get_valid_by_hash("c" * 64) is None
    finally:
        session.close()
