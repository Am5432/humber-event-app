from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from app.adapters.persistence.models import (
    AuthIdentityModel,
    CategoryModel,
    EventImageModel,
    EventModel,
    EventRegistrationModel,
    PasswordResetTokenModel,
    RefreshTokenModel,
    UserModel,
)
from app.domain.users.entities import User, UserRole


def _to_domain(model: UserModel) -> User:
    return User(
        id=model.id,
        email=model.email,
        display_name=model.display_name,
        role=UserRole(model.role),
    )


# Category repository for fetching available categories
class CategoryRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_id(self, category_id: str) -> CategoryModel | None:
        """Retrieve a category by ID."""
        from sqlalchemy import select

        statement = select(CategoryModel).where(CategoryModel.id == category_id)
        return self._session.execute(statement).scalar_one_or_none()

    def list_all(self) -> list[CategoryModel]:
        """Load all categories."""
        from sqlalchemy import select

        statement = select(CategoryModel)
        return self._session.execute(statement).scalars().all()

    def get_by_name(self, name: str) -> CategoryModel | None:
        """Find category by exact name match."""
        from sqlalchemy import select

        statement = select(CategoryModel).where(CategoryModel.name == name)
        return self._session.execute(statement).scalar_one_or_none()


# Event repository for event persistence with ownership filtering
class EventRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_id(self, event_id: str) -> EventModel | None:
        """Retrieve an event by ID with categories loaded."""
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        statement = (
            select(EventModel)
            .where(EventModel.id == event_id)
            .options(
                selectinload(EventModel.categories),
                selectinload(EventModel.images),
            )
        )
        return self._session.execute(statement).scalar_one_or_none()

    def list_by_organizer(
            self,
            organizer_id: str,
            status_filter: str | None = None,
    ) -> list[EventModel]:
        """List events for an organizer, filtered by status if provided."""
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        query = select(EventModel).where(EventModel.organizer_id == organizer_id)
        if status_filter:
            query = query.where(EventModel.status == status_filter)
        statement = query.options(
            selectinload(EventModel.categories),
            selectinload(EventModel.images),
        )
        return self._session.execute(statement).scalars().all()

    def list_pending(self) -> list[EventModel]:
        """Return all pending events with categories loaded."""
        statement = (
            select(EventModel)
            .where(EventModel.status == "pending")
            .options(
                selectinload(EventModel.categories),
                selectinload(EventModel.images),
            )
        )
        return self._session.execute(statement).scalars().all()

    def analytics_summary(self) -> dict[str, int]:
        """Return aggregate counts for the admin dashboard."""
        events = self._session.execute(select(EventModel)).scalars().all()
        users = self._session.execute(select(UserModel)).scalars().all()
        return {
            "total_events": len(events),
            "approved_events": sum(1 for event in events if event.status == "approved"),
            "pending_events": sum(1 for event in events if event.status == "pending"),
            "rejected_events": sum(1 for event in events if event.status == "rejected"),
            "total_registrations": sum(
                (getattr(event, "registrations_count", 0) or 0)
                for event in events
            ),
            "total_users": len(users),
            "student_users": sum(1 for user in users if user.role == UserRole.STUDENT.value),
            "organizer_users": sum(1 for user in users if user.role == UserRole.ORGANIZER.value),
            "admin_users": sum(1 for user in users if user.role == UserRole.ADMIN.value),
        }

    def list_approved(
            self,
            q: str | None = None,
            category: str | None = None,
            date_from: str | None = None,
            date_to: str | None = None,
            location: str | None = None,
    ) -> list[EventModel]:
        """Return approved events with optional combined filters."""
        query = (
            select(EventModel)
            .where(EventModel.status == "approved")
            .options(
                selectinload(EventModel.categories),
                selectinload(EventModel.images),
            )
        )

        if q:
            query = query.where(
                or_(
                    EventModel.title.ilike(f"%{q}%"),
                    EventModel.description.ilike(f"%{q}%"),
                )
            )

        if category:
            query = query.join(EventModel.categories).where(CategoryModel.name == category)

        if date_from:
            parsed_from = date.fromisoformat(date_from)
            from_dt = datetime(
                parsed_from.year,
                parsed_from.month,
                parsed_from.day,
                tzinfo=timezone.utc,
            )
            query = query.where(EventModel.date_time >= from_dt)

        if date_to:
            parsed_to = date.fromisoformat(date_to)
            to_dt = datetime(
                parsed_to.year,
                parsed_to.month,
                parsed_to.day,
                23,
                59,
                59,
                tzinfo=timezone.utc,
            )
            query = query.where(EventModel.date_time <= to_dt)

        if location:
            query = query.where(EventModel.location.ilike(f"%{location}%"))

        return self._session.execute(query.distinct()).scalars().all()

    def get_registered_event_ids(self, user_id: int, event_ids: list[str]) -> set[str]:
        """Return event ids already registered by the given user."""
        if not event_ids:
            return set()

        statement = (
            select(EventRegistrationModel.event_id)
            .where(EventRegistrationModel.user_id == user_id)
            .where(EventRegistrationModel.event_id.in_(event_ids))
        )
        return {
            event_id
            for event_id in self._session.execute(statement).scalars().all()
        }

    def list_registered_by_user(
            self,
            user_id: int,
            *,
            limit: int | None = None,
    ) -> list[dict[str, object]]:
        """Return a user's registered events ordered by newest registration first."""
        statement = (
            select(EventModel, EventRegistrationModel.created_at)
            .join(
                EventRegistrationModel,
                EventRegistrationModel.event_id == EventModel.id,
            )
            .where(EventRegistrationModel.user_id == user_id)
            .options(selectinload(EventModel.categories))
            .order_by(EventRegistrationModel.created_at.desc())
        )
        if limit is not None:
            statement = statement.limit(limit)

        rows = self._session.execute(statement).all()
        return [
            {"event": event, "registered_at": registered_at}
            for event, registered_at in rows
        ]

    def create(self, organizer_id: str, *, commit: bool = True, **kwargs) -> EventModel:
        """Create a new event with the given organizer_id."""
        categories = kwargs.pop("categories", [])
        event = EventModel(
            organizer_id=organizer_id,
            **kwargs,
        )
        self._session.add(event)
        self._session.flush()

        if categories:
            event.categories = categories

        if commit:
            self._session.commit()
            self._session.refresh(event)
        return event

    def update(
        self,
        event_id: str,
        organizer_id: str,
        *,
        commit: bool = True,
        **kwargs,
    ) -> EventModel | None:
        """Update an event - only if the organizer is the owner."""
        event = self.get_by_id(event_id)
        if not event:
            return None

        # Ownership verification
        if event.organizer_id != organizer_id:
            return None

        # Pending/completed events stay locked. Draft, rejected, and approved are editable.
        if event.status not in ("draft", "rejected", "approved"):
            return None

        should_resubmit_for_review = False
        if event.status == "approved":
            should_resubmit_for_review = any(
                key in kwargs and kwargs[key] != getattr(event, key)
                for key in ("date_time", "location")
            )

        # Update allowed scalar fields
        allowed_fields = [
            "title",
            "description",
            "date_time",
            "location",
            "capacity",
        ]
        for key, value in kwargs.items():
            if key in allowed_fields and hasattr(event, key):
                setattr(event, key, value)

        if event.status != "rejected":
            event.rejection_reason = None

        # Update categories if provided
        if "categories" in kwargs:
            event.categories = kwargs["categories"]

        if should_resubmit_for_review:
            event.status = "pending"
            event.submitted_at = datetime.now(timezone.utc)
            event.rejection_reason = None

        if commit:
            self._session.commit()
            self._session.refresh(event)
        return event

    def update_status(
            self,
            event_id: str,
            new_status: str,
            rejection_reason: str | None = None,
    ) -> EventModel | None:
        """Update event status and persist the moderation outcome."""
        event = self.get_by_id(event_id)
        if not event:
            return None

        event.status = new_status
        if new_status == "rejected":
            event.rejection_reason = rejection_reason
        else:
            event.rejection_reason = None

        self._session.commit()
        self._session.refresh(event)
        return event

    def register_for_event(self, event_id: str, user_id: int) -> EventModel | None:
        """Increment registrations for an approved event when capacity allows."""
        event = self.get_by_id(event_id)
        if not event:
            return None

        if event.status != "approved":
            return None

        existing_registration = self._session.execute(
            select(EventRegistrationModel)
            .where(EventRegistrationModel.user_id == user_id)
            .where(EventRegistrationModel.event_id == event_id)
        ).scalar_one_or_none()
        if existing_registration is not None:
            return None

        if event.registrations_count >= event.capacity:
            return None

        self._session.add(
            EventRegistrationModel(
                user_id=user_id,
                event_id=event_id,
            )
        )
        event.registrations_count += 1
        self._session.commit()
        self._session.refresh(event)
        return event

    def deregister_for_event(self, event_id: str, user_id: int) -> EventModel | None:
        """Remove a user's event registration and decrement the counter."""
        event = self.get_by_id(event_id)
        if not event:
            return None

        existing_registration = self._session.execute(
            select(EventRegistrationModel)
            .where(EventRegistrationModel.user_id == user_id)
            .where(EventRegistrationModel.event_id == event_id)
        ).scalar_one_or_none()
        if existing_registration is None:
            return None

        self._session.delete(existing_registration)
        event.registrations_count = max((event.registrations_count or 0) - 1, 0)
        self._session.commit()
        self._session.refresh(event)
        return event

    def delete(self, event_id: str, organizer_id: str) -> bool:
        """Delete an event - only if the organizer is the owner."""
        event = self.get_by_id(event_id)
        if not event:
            return False

        # Ownership verification
        if event.organizer_id != organizer_id:
            return False

        # Can only delete draft events
        if event.status != "draft":
            return False

        self._session.delete(event)
        self._session.commit()
        return True


class UserRepository:
    """Repository for user persistence."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_email(self, email: str) -> User | None:
        statement = select(UserModel).where(UserModel.email == email)
        model = self._session.scalar(statement)
        if model is None:
            return None
        return _to_domain(model)

    def get_by_identity(self, provider: str, provider_subject: str) -> User | None:
        statement = (
            select(UserModel)
            .join(AuthIdentityModel, AuthIdentityModel.user_id == UserModel.id)
            .where(AuthIdentityModel.provider == provider)
            .where(AuthIdentityModel.provider_subject == provider_subject)
        )
        model = self._session.scalar(statement)
        if model is None:
            return None
        return _to_domain(model)

    def get_by_id(self, user_id: int) -> User | None:
        statement = select(UserModel).where(UserModel.id == user_id)
        model = self._session.scalar(statement)
        if model is None:
            return None
        return _to_domain(model)

    def list_public_summaries(self, user_ids: list[int]) -> dict[int, dict[str, object]]:
        if not user_ids:
            return {}

        statement = select(UserModel).where(UserModel.id.in_(user_ids))
        models = self._session.execute(statement).scalars().all()
        return {
            model.id: {
                "id": model.id,
                "display_name": model.display_name,
                "role": model.role,
            }
            for model in models
        }

    def list_admin_users(
        self,
        *,
        q: str | None = None,
        role: UserRole | None = None,
    ) -> list[UserModel]:
        statement = select(UserModel).order_by(UserModel.created_at.desc(), UserModel.id.desc())

        if q:
            pattern = f"%{q.strip()}%"
            statement = statement.where(
                or_(
                    UserModel.display_name.ilike(pattern),
                    UserModel.email.ilike(pattern),
                )
            )

        if role is not None:
            statement = statement.where(UserModel.role == role.value)

        return self._session.execute(statement).scalars().all()

    def update_role(self, user_id: int, role: UserRole) -> UserModel:
        statement = select(UserModel).where(UserModel.id == user_id)
        model = self._session.scalar(statement)
        if model is None:
            raise LookupError(f"User {user_id} was not found.")

        model.role = role.value
        self._session.commit()
        self._session.refresh(model)
        return model

    def get_public_profile(self, user_id: int) -> dict[str, object] | None:
        statement = select(UserModel).where(UserModel.id == user_id)
        model = self._session.scalar(statement)
        if model is None:
            return None

        organized_events_count = self._session.scalar(
            select(func.count())
            .select_from(EventModel)
            .where(EventModel.organizer_id == str(user_id))
        ) or 0
        approved_events_count = self._session.scalar(
            select(func.count())
            .select_from(EventModel)
            .where(EventModel.organizer_id == str(user_id))
            .where(EventModel.status == "approved")
        ) or 0
        registered_events_count = self._session.scalar(
            select(func.count())
            .select_from(EventRegistrationModel)
            .where(EventRegistrationModel.user_id == user_id)
        ) or 0

        return {
            "id": model.id,
            "display_name": model.display_name,
            "role": model.role,
            "created_at": model.created_at,
            "organized_events_count": organized_events_count,
            "approved_events_count": approved_events_count,
            "registered_events_count": registered_events_count,
        }

    def create_user(
            self,
            *,
            email: str,
            display_name: str,
            role: UserRole,
            **kwargs,
    ) -> User:
        model = UserModel(
            email=email,
            display_name=display_name,
            role=role.value,
        )
        self._session.add(model)
        self._session.commit()
        self._session.refresh(model)
        return _to_domain(model)

    def set_password_hash(
            self,
            user_id: int,
            password_hash: str,
            *,
            commit: bool = True,
    ) -> None:
        statement = select(UserModel).where(UserModel.id == user_id)
        model = self._session.scalar(statement)
        if model is None:
            raise ValueError(f"User {user_id} not found.")

        model.password_hash = password_hash
        if commit:
            self._session.commit()

    def get_password_hash_for_email(self, email: str) -> str | None:
        statement = select(UserModel).where(UserModel.email == email)
        model = self._session.scalar(statement)
        if model is None:
            return None
        return model.password_hash

    def link_identity(self, *, user_id: int, provider: str, provider_subject: str) -> None:
        statement = (
            select(AuthIdentityModel)
            .where(AuthIdentityModel.provider == provider)
            .where(AuthIdentityModel.provider_subject == provider_subject)
        )
        existing = self._session.scalar(statement)
        if existing is not None:
            if existing.user_id != user_id:
                raise ValueError(
                    f"Identity {provider}:{provider_subject} is already linked to another user."
                )
            return

        identity = AuthIdentityModel(
            user_id=user_id,
            provider=provider,
            provider_subject=provider_subject,
        )
        self._session.add(identity)
        self._session.commit()

    def update_display_name(self, user_id: int, display_name: str) -> User:
        statement = select(UserModel).where(UserModel.id == user_id)
        model = self._session.scalar(statement)
        if model is None:
            raise LookupError(f"User {user_id} was not found.")

        model.display_name = display_name
        self._session.commit()
        self._session.refresh(model)
        return _to_domain(model)


class RefreshTokenRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(
            self,
            user_id: int,
            token_hash: str,
            expires_at: datetime,
    ) -> RefreshTokenModel:
        token = RefreshTokenModel(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            created_at=datetime.now(timezone.utc),
        )
        self._session.add(token)
        self._session.commit()
        self._session.refresh(token)
        return token

    def get_valid_by_hash(self, token_hash: str) -> RefreshTokenModel | None:
        """Return token only if not revoked and not expired."""
        now = datetime.now(timezone.utc)
        statement = (
            select(RefreshTokenModel)
            .where(RefreshTokenModel.token_hash == token_hash)
            .where(RefreshTokenModel.revoked_at.is_(None))
            .where(RefreshTokenModel.expires_at > now)
        )
        return self._session.execute(statement).scalar_one_or_none()

    def revoke(self, token_hash: str) -> None:
        statement = select(RefreshTokenModel).where(
            RefreshTokenModel.token_hash == token_hash
        )
        token = self._session.execute(statement).scalar_one_or_none()
        if token is None:
            return

        token.revoked_at = datetime.now(timezone.utc)
        self._session.commit()

    def revoke_all_for_user(self, user_id: int, *, commit: bool = True) -> None:
        statement = (
            update(RefreshTokenModel)
            .where(RefreshTokenModel.user_id == user_id)
            .where(RefreshTokenModel.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )
        self._session.execute(statement)
        if commit:
            self._session.commit()

    def delete(self, token_hash: str) -> None:
        statement = select(RefreshTokenModel).where(
            RefreshTokenModel.token_hash == token_hash
        )
        token = self._session.execute(statement).scalar_one_or_none()
        if token is None:
            return

        self._session.delete(token)
        self._session.commit()


class PasswordResetTokenRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(
            self,
            *,
            user_id: int,
            token_hash: str,
            expires_at: datetime,
    ) -> PasswordResetTokenModel:
        token = PasswordResetTokenModel(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            created_at=datetime.now(timezone.utc),
        )
        self._session.add(token)
        self._session.commit()
        self._session.refresh(token)
        return token

    def get_valid_by_hash(self, token_hash: str) -> PasswordResetTokenModel | None:
        now = datetime.now(timezone.utc)
        statement = (
            select(PasswordResetTokenModel)
            .where(PasswordResetTokenModel.token_hash == token_hash)
            .where(PasswordResetTokenModel.expires_at > now)
            .where(PasswordResetTokenModel.used_at.is_(None))
        )
        return self._session.scalar(statement)

    def consume_valid_by_hash(
            self,
            token_hash: str,
            *,
            commit: bool = True,
    ) -> PasswordResetTokenModel | None:
        now = datetime.now(timezone.utc)
        statement = (
            update(PasswordResetTokenModel)
            .where(PasswordResetTokenModel.token_hash == token_hash)
            .where(PasswordResetTokenModel.expires_at > now)
            .where(PasswordResetTokenModel.used_at.is_(None))
            .values(used_at=now)
            .returning(PasswordResetTokenModel)
        )
        token = self._session.execute(statement).scalar_one_or_none()
        if commit:
            self._session.commit()
        return token

    def mark_used(self, token_hash: str) -> None:
        statement = select(PasswordResetTokenModel).where(
            PasswordResetTokenModel.token_hash == token_hash
        )
        token = self._session.scalar(statement)
        if token is None:
            return

        token.used_at = datetime.now(timezone.utc)
        self._session.commit()
