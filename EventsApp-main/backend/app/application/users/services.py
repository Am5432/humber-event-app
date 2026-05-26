from __future__ import annotations

from app.adapters.auth.interfaces import VerifiedIdentity
from app.adapters.persistence.repositories import UserRepository
from app.application.users.dto import AdminUserResponse, CurrentUserResponse
from app.domain.users import policies
from app.domain.users.entities import UserRole


class UserService:
    def __init__(self, repository: UserRepository) -> None:
        self._repository = repository

    def _resolve_role(self, identity: VerifiedIdentity) -> UserRole:
        if identity.role is not None:
            return UserRole(identity.role)

        email = identity.email.strip().lower()
        return policies.derive_role_from_email(email)

    def resolve_current_user(self, identity: VerifiedIdentity) -> CurrentUserResponse:
        email = identity.email.strip().lower()
        display_name = identity.display_name or email.split("@", 1)[0]
        role = self._resolve_role(identity)

        user = None
        if identity.provider != "jwt":
            user = self._repository.get_by_identity(
                identity.provider,
                identity.external_uid,
            )

        if user is None:
            user = self._repository.get_by_email(email)

        if user is None:
            user = self._repository.create_user(
                email=email,
                display_name=display_name,
                role=role,
            )

        if identity.provider != "jwt":
            self._repository.link_identity(
                user_id=user.id,
                provider=identity.provider,
                provider_subject=identity.external_uid,
            )

        return CurrentUserResponse.model_validate(user)

    def get_current_user_profile(
        self,
        identity: VerifiedIdentity,
    ) -> CurrentUserResponse:
        return self.resolve_current_user(identity)

    def list_admin_users(
        self,
        *,
        q: str | None = None,
        role: UserRole | None = None,
    ) -> list[AdminUserResponse]:
        users = self._repository.list_admin_users(q=q, role=role)
        return [AdminUserResponse.model_validate(user) for user in users]

    def update_admin_user_role(
        self,
        *,
        actor_user_id: int,
        target_user_id: int,
        role: UserRole,
    ) -> AdminUserResponse:
        if actor_user_id == target_user_id and role != UserRole.ADMIN:
            raise ValueError("Admins cannot remove their own admin role.")

        updated_user = self._repository.update_role(target_user_id, role)
        return AdminUserResponse.model_validate(updated_user)

    def update_current_user_display_name(
        self,
        identity: VerifiedIdentity,
        display_name: str,
    ) -> CurrentUserResponse:
        current_user = self.resolve_current_user(identity)
        return self.update_user_display_name(current_user.id, display_name)

    def update_user_display_name(
        self,
        user_id: int,
        display_name: str,
    ) -> CurrentUserResponse:
        updated_user = self._repository.update_display_name(
            user_id,
            display_name.strip(),
        )
        return CurrentUserResponse.model_validate(updated_user)
