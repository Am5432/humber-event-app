"""Student-facing event discovery endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.adapters.http.dependencies import get_current_user, get_session
from app.adapters.http.schemas.discovery import (
    DiscoveryEventDetail,
    DiscoveryEventSummary,
)
from app.adapters.persistence.repositories import EventRepository, UserRepository
from app.application.discovery.services import DiscoveryService
from app.application.users.dto import PublicUserSummaryResponse
from app.application.users.dto import CurrentUserResponse


router = APIRouter(prefix="/events", tags=["Discovery"])


def _get_discovery_service(session: Session) -> DiscoveryService:
    return DiscoveryService(event_repo=EventRepository(session))


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


def _model_to_response(
    model,
    *,
    organizer_lookup: dict[str, PublicUserSummaryResponse],
    is_registered: bool = False,
    include_gallery: bool = False,
) -> dict:
    cover_image = None
    if model.images:
        first_image = sorted(model.images, key=lambda image: image.sort_order)[0]
        cover_image = {
            "id": first_image.id,
            "thumbnail_url": first_image.thumbnail_url,
            "width": first_image.width,
            "height": first_image.height,
        }

    return {
        "id": model.id,
        "title": model.title,
        "description": model.description,
        "date_time": model.date_time,
        "location": model.location,
        "capacity": model.capacity,
        "registrations_count": model.registrations_count,
        "organizer_id": model.organizer_id,
        "status": model.status,
        "created_at": model.created_at,
        "submitted_at": model.submitted_at,
        "categories": [cat.name for cat in model.categories],
        "organizer": organizer_lookup.get(model.organizer_id),
        "is_registered": is_registered,
        "cover_image": cover_image,
        **(
            {
                "gallery_images": [
                    {
                        "id": image.id,
                        "position": image.sort_order,
                        "original_url": image.original_url,
                        "display_url": image.display_url,
                        "thumbnail_url": image.thumbnail_url,
                        "width": image.width,
                        "height": image.height,
                    }
                    for image in sorted(model.images, key=lambda item: item.sort_order)
                ]
            }
            if include_gallery
            else {}
        ),
    }


@router.get("", response_model=list[DiscoveryEventSummary])
async def list_approved_events(
    q: str | None = None,
    category: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    location: str | None = None,
    current_user: CurrentUserResponse = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    service = _get_discovery_service(session)
    try:
        events = service.list_approved(
            q=q,
            category=category,
            date_from=date_from,
            date_to=date_to,
            location=location,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
    organizer_lookup = _build_organizer_lookup(
        session,
        [event.organizer_id for event in events],
    )
    registered_event_ids = EventRepository(session).get_registered_event_ids(
        current_user.id,
        [event.id for event in events],
    )
    return [
        _model_to_response(
            event,
            organizer_lookup=organizer_lookup,
            is_registered=event.id in registered_event_ids,
            include_gallery=False,
        )
        for event in events
    ]


@router.get("/{event_id}", response_model=DiscoveryEventDetail)
async def get_approved_event(
    event_id: str,
    current_user: CurrentUserResponse = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    service = _get_discovery_service(session)
    event = service.get_approved_event(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found or not available.",
        )
    organizer_lookup = _build_organizer_lookup(session, [event.organizer_id])
    registered_event_ids = EventRepository(session).get_registered_event_ids(
        current_user.id,
        [event.id],
    )
    return _model_to_response(
        event,
        organizer_lookup=organizer_lookup,
        is_registered=event.id in registered_event_ids,
        include_gallery=True,
    )


@router.post("/{event_id}/register", response_model=DiscoveryEventDetail)
async def register_for_event(
    event_id: str,
    current_user: CurrentUserResponse = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    repo = EventRepository(session)
    event = repo.register_for_event(event_id, current_user.id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event not found, unavailable, or already full.",
        )
    organizer_lookup = _build_organizer_lookup(session, [event.organizer_id])
    return _model_to_response(
        event,
        organizer_lookup=organizer_lookup,
        is_registered=True,
        include_gallery=True,
    )


@router.delete("/{event_id}/register", response_model=DiscoveryEventDetail)
async def deregister_for_event(
    event_id: str,
    current_user: CurrentUserResponse = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    repo = EventRepository(session)
    event = repo.deregister_for_event(event_id, current_user.id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration not found or event unavailable.",
        )
    organizer_lookup = _build_organizer_lookup(session, [event.organizer_id])
    return _model_to_response(
        event,
        organizer_lookup=organizer_lookup,
        is_registered=False,
        include_gallery=True,
    )
