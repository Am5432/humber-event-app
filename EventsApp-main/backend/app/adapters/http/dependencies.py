from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.adapters.persistence.repositories import UserRepository
from app.application.users.dto import CurrentUserResponse
from app.application.users.services import UserService
from app.bootstrap.app import get_auth_provider
from app.bootstrap.db import get_session
from app.domain.users.policies import require_role
from app.adapters.auth.interfaces import AuthProvider


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    auth_provider: AuthProvider=Depends(get_auth_provider),
    session: Session = Depends(get_session),
) -> CurrentUserResponse:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required.",
        )

    try:
        identity = auth_provider.verify_token(credentials.credentials)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token.",
        ) from error

    user_service = UserService(UserRepository(session))
    try:
        return user_service.get_current_user_profile(identity)
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error


def require_roles(*allowed_roles: str) -> Callable[[CurrentUserResponse], CurrentUserResponse]:
    def dependency(
        current_user: CurrentUserResponse = Depends(get_current_user),
    ) -> CurrentUserResponse:
        try:
            require_role(current_user.role, allowed_roles)
        except PermissionError as error:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=str(error),
            ) from error
        return current_user

    return dependency
