from __future__ import annotations

from collections.abc import Iterable

from app.domain.users.entities import UserRole

SPECIAL_ORGANIZER_EMAILS = {
    "n01210458@gmail.com",
}


def _normalize_roles(roles: Iterable[str | UserRole]) -> set[UserRole]:
    normalized_roles: set[UserRole] = set()
    for role in roles:
        normalized_roles.add(role if isinstance(role, UserRole) else UserRole(role))
    return normalized_roles


def require_role(
        user_role: str | UserRole,
        allowed_roles: Iterable[str | UserRole],
) -> UserRole:
    current_role = user_role if isinstance(user_role, UserRole) else UserRole(user_role)
    permitted_roles = _normalize_roles(allowed_roles)

    if current_role not in {
        UserRole.STUDENT,
        UserRole.ORGANIZER,
        UserRole.ADMIN,
        UserRole.REGULAR,
    }:
        raise PermissionError("Unknown local role.")

    if current_role not in permitted_roles:
        allowed_values = ", ".join(sorted(role.value for role in permitted_roles))
        raise PermissionError(
            f"Role '{current_role.value}' is not allowed. Expected one of: {allowed_values}.",
        )

    return current_role


def is_student_email(email: str) -> bool:
    return email.strip().lower().endswith("@humber.ca")


def derive_role_from_email(email: str) -> UserRole:
    normalized_email = email.strip().lower()
    if normalized_email in SPECIAL_ORGANIZER_EMAILS:
        return UserRole.ORGANIZER
    return UserRole.STUDENT if is_student_email(email) else UserRole.REGULAR
