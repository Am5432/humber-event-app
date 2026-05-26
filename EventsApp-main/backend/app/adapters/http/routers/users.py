from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.adapters.http.dependencies import get_current_user
from app.adapters.http.schemas.discovery import RegisteredEventResponse
from app.adapters.persistence.repositories import EventRepository
from app.application.users.dto import (
    CurrentUserResponse,
    PublicUserProfileResponse,
    PublicUserSummaryResponse,
    UpdateProfileRequest,
)
from app.application.users.services import UserService
from app.adapters.persistence.repositories import UserRepository
from app.bootstrap.db import get_session


router = APIRouter(tags=["users"])


def _get_user_service(session: Session = Depends(get_session)) -> UserService:
    return UserService(UserRepository(session))


def _build_organizer_lookup(
    session: Session,
    organizer_ids: list[str],
) -> dict[str, PublicUserSummaryResponse]:
    numeric_ids = [
        int(organizer_id)
        for organizer_id in organizer_ids
        if organizer_id.isdigit()
    ]
    summaries = UserRepository(session).list_public_summaries(numeric_ids)
    return {
        str(user_id): PublicUserSummaryResponse(**summary)
        for user_id, summary in summaries.items()
    }


def _serialize_registered_event(
    payload: dict[str, object],
    organizer_lookup: dict[str, PublicUserSummaryResponse],
) -> dict[str, object]:
    event = payload["event"]
    return {
        "id": event.id,
        "title": event.title,
        "description": event.description,
        "date_time": event.date_time,
        "location": event.location,
        "capacity": event.capacity,
        "registrations_count": event.registrations_count,
        "organizer_id": event.organizer_id,
        "status": event.status,
        "created_at": event.created_at,
        "submitted_at": event.submitted_at,
        "categories": [category.name for category in event.categories],
        "organizer": organizer_lookup.get(event.organizer_id),
        "is_registered": True,
        "registered_at": payload["registered_at"],
    }


@router.get("/users/me", response_model=CurrentUserResponse)
def get_current_user_profile(
    current_user: CurrentUserResponse = Depends(get_current_user),
) -> CurrentUserResponse:
    return current_user


@router.patch("/users/me", response_model=CurrentUserResponse)
def update_current_user_profile(
    payload: UpdateProfileRequest,
    current_user: CurrentUserResponse = Depends(get_current_user),
    user_service: UserService = Depends(_get_user_service),
) -> CurrentUserResponse:
    return user_service.update_user_display_name(
        current_user.id,
        payload.display_name,
    )


@router.get("/users/me/registrations", response_model=list[RegisteredEventResponse])
def list_current_user_registrations(
    limit: int | None = Query(default=None, ge=1, le=50),
    current_user: CurrentUserResponse = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[RegisteredEventResponse]:
    payloads = EventRepository(session).list_registered_by_user(
        current_user.id,
        limit=limit,
    )
    organizer_lookup = _build_organizer_lookup(
        session,
        [payload["event"].organizer_id for payload in payloads],
    )
    return [
        RegisteredEventResponse(**_serialize_registered_event(payload, organizer_lookup))
        for payload in payloads
    ]


@router.get("/users/{user_id}", response_model=PublicUserProfileResponse)
def get_public_user_profile(
    user_id: int,
    session: Session = Depends(get_session),
) -> PublicUserProfileResponse:
    profile = UserRepository(session).get_public_profile(user_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    return PublicUserProfileResponse(**profile)
