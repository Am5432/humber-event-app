"""Admin user management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.adapters.http.dependencies import get_session, require_roles
from app.adapters.persistence.repositories import UserRepository
from app.application.users.dto import (
    AdminUpdateUserRoleRequest,
    AdminUserResponse,
    CurrentUserResponse,
)
from app.application.users.services import UserService
from app.domain.users.entities import UserRole


router = APIRouter(prefix="/admin/users", tags=["Admin Users"])

_admin_required = require_roles("admin")


def _get_user_service(session: Session) -> UserService:
    return UserService(UserRepository(session))


@router.get("", response_model=list[AdminUserResponse])
async def list_users(
    q: str | None = Query(None, min_length=1, max_length=255),
    role: UserRole | None = Query(None),
    current_user: CurrentUserResponse = Depends(_admin_required),
    session: Session = Depends(get_session),
) -> list[AdminUserResponse]:
    del current_user
    service = _get_user_service(session)
    return service.list_admin_users(q=q, role=role)


@router.patch("/{user_id}/role", response_model=AdminUserResponse)
async def update_user_role(
    user_id: int,
    payload: AdminUpdateUserRoleRequest,
    current_user: CurrentUserResponse = Depends(_admin_required),
    session: Session = Depends(get_session),
) -> AdminUserResponse:
    service = _get_user_service(session)
    try:
        return service.update_admin_user_role(
            actor_user_id=current_user.id,
            target_user_id=user_id,
            role=UserRole(payload.role),
        )
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
