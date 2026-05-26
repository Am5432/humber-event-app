from __future__ import annotations

import mimetypes

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.adapters.http.dependencies import get_current_user, get_session
from app.adapters.media.storage import LocalEventImageStorage
from app.adapters.persistence.repositories import EventRepository
from app.application.users.dto import CurrentUserResponse


router = APIRouter(tags=["Media"])


def _get_storage(request: Request) -> LocalEventImageStorage:
    return request.app.state.media_storage


def _can_access_event_media(event, current_user: CurrentUserResponse) -> bool:
    if event.status == "approved":
        return True
    if current_user.role == "admin":
        return True
    return current_user.role == "organizer" and event.organizer_id == str(current_user.id)


@router.get("/events/{event_id}/{image_id}/{filename}")
async def get_event_image(
    event_id: str,
    image_id: str,
    filename: str,
    current_user: CurrentUserResponse = Depends(get_current_user),
    session: Session = Depends(get_session),
    storage: LocalEventImageStorage = Depends(_get_storage),
):
    event = EventRepository(session).get_by_id(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found.",
        )
    if not _can_access_event_media(event, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this event image.",
        )

    try:
        resolved_path = storage.resolve_event_image_path(event_id, image_id, filename)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event image not found.",
        ) from error

    if not resolved_path.exists() or not resolved_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event image not found.",
        )

    media_type, _ = mimetypes.guess_type(resolved_path.name)
    return FileResponse(resolved_path, media_type=media_type)
