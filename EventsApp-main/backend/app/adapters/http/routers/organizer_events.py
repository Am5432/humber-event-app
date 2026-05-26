"""Organizer event management endpoints."""

from __future__ import annotations

from json import JSONDecodeError
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.adapters.http.dependencies import get_session, require_roles
from app.adapters.http.schemas.events import (
    CreateEventSchema,
    OrganizerEventResponse,
    EventUpdateResponse,
    UpdateEventSchema,
    parse_image_manifest_json,
)
from app.adapters.persistence.repositories import EventRepository, CategoryRepository
from app.application.organizer.image_service import OrganizerEventImageService
from app.application.organizer.services import OrganizerEventService
from app.application.users.dto import CurrentUserResponse


router = APIRouter(prefix="/organizer/events", tags=["Organizer Events"])

_organizer_required = require_roles("organizer", "admin")


def _get_event_service(
    session: Session,
    request: Request | None = None,
) -> OrganizerEventService:
    """Create event service with repositories."""
    image_service = None
    if request is not None:
        image_service = OrganizerEventImageService(
            session=session,
            storage=request.app.state.media_storage,
            max_images_per_event=request.app.state.settings.max_event_images_per_event,
            max_event_image_bytes=request.app.state.settings.max_event_image_bytes,
        )
    return OrganizerEventService(
        event_repo=EventRepository(session),
        category_repo=CategoryRepository(session),
        image_service=image_service,
    )


def _image_to_response(image) -> dict:
    return {
        "id": image.id,
        "position": image.sort_order,
        "original_url": image.original_url,
        "display_url": image.display_url,
        "thumbnail_url": image.thumbnail_url,
        "width": image.width,
        "height": image.height,
    }


def _model_to_response(model) -> dict:
    """Convert EventModel to response dict."""
    return {
        "id": model.id,
        "title": model.title,
        "description": model.description,
        "date_time": model.date_time,
        "location": model.location,
        "capacity": model.capacity,
        "organizer_id": model.organizer_id,
        "status": model.status,
        "created_at": model.created_at,
        "submitted_at": model.submitted_at,
        "rejection_reason": model.rejection_reason,
        "categories": [cat.name for cat in model.categories],
        "images": [
            _image_to_response(image)
            for image in sorted(model.images, key=lambda item: item.sort_order)
        ],
    }


async def _parse_event_request(
    request: Request,
    *,
    partial: bool,
) -> tuple[CreateEventSchema | UpdateEventSchema, list | None, dict[str, UploadFile]]:
    content_type = request.headers.get("content-type", "").lower()
    schema = UpdateEventSchema if partial else CreateEventSchema
    if content_type.startswith("application/json"):
        try:
            payload = await request.json()
        except JSONDecodeError as error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Request body must contain valid JSON.",
            ) from error
        try:
            return schema.model_validate(payload), None, {}
        except ValidationError as error:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=error.errors(),
            ) from error

    form = await request.form()
    data = {}
    for field in ("title", "description", "date_time", "location", "capacity"):
        value = form.get(field)
        if value not in ("", None):
            data[field] = value
    category_ids = [value for value in form.getlist("category_ids") if value]
    if category_ids or (not partial and form.getlist("category_ids") == []):
        data["category_ids"] = category_ids

    try:
        validated = schema.model_validate(data)
    except ValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=error.errors(),
        ) from error

    manifest_raw = form.get("image_manifest_json")
    try:
        image_manifest = (
            parse_image_manifest_json(manifest_raw)
            if manifest_raw is not None
            else ([] if not partial else None)
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    client_ids = [value for value in form.getlist("image_file_client_ids") if value]
    upload_entries = list(form.getlist("image_files"))
    if len(client_ids) != len(upload_entries):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="image_file_client_ids must align with image_files.",
        )
    if len(set(client_ids)) != len(client_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="image_file_client_ids must be unique within a request.",
        )

    image_uploads: dict[str, UploadFile] = {}
    for client_id, upload in zip(client_ids, upload_entries):
        if not hasattr(upload, "read") or not hasattr(upload, "filename"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="image_files must contain uploaded files.",
            )
        image_uploads[client_id] = upload

    if image_uploads and image_manifest is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="image_manifest_json is required when uploading event images.",
        )

    return validated, image_manifest, image_uploads


@router.get("", response_model=List[OrganizerEventResponse])
async def list_events(
    status_filter: str | None = None,
    current_user: CurrentUserResponse = Depends(_organizer_required),
    session: Session = Depends(get_session),
):
    """List all events for the current organizer."""
    service = _get_event_service(session)
    events = service._event_repo.list_by_organizer(
        organizer_id=str(current_user.id),
        status_filter=status_filter,
    )
    return [_model_to_response(e) for e in events]


@router.post(
    "", response_model=EventUpdateResponse, status_code=status.HTTP_201_CREATED
)
async def create_event(
    request: Request,
    current_user: CurrentUserResponse = Depends(_organizer_required),
    session: Session = Depends(get_session),
):
    """Create a new draft event for the current organizer."""
    event_data, image_manifest, image_uploads = await _parse_event_request(
        request,
        partial=False,
    )
    service = _get_event_service(session, request)

    try:
        new_event = await service.create_event_with_images(
            organizer_id=str(current_user.id),
            title=event_data.title,
            description=event_data.description,
            date_time=event_data.date_time,
            location=event_data.location,
            capacity=event_data.capacity,
            category_ids=event_data.category_ids,
            image_manifest=image_manifest,
            image_uploads=image_uploads,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return _model_to_response(new_event)


@router.get("/{event_id}", response_model=OrganizerEventResponse)
async def get_event(
    event_id: str,
    current_user: CurrentUserResponse = Depends(_organizer_required),
    session: Session = Depends(get_session),
):
    """Get a specific event by ID."""
    service = _get_event_service(session)
    event = service._event_repo.get_by_id(event_id)

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )

    if event.organizer_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized"
        )

    return _model_to_response(event)


@router.patch("/{event_id}", response_model=EventUpdateResponse)
async def update_event(
    event_id: str,
    request: Request,
    current_user: CurrentUserResponse = Depends(_organizer_required),
    session: Session = Depends(get_session),
):
    """Update an existing draft or rejected event."""
    event_data, image_manifest, image_uploads = await _parse_event_request(
        request,
        partial=True,
    )
    service = _get_event_service(session, request)

    update_data = {k: v for k, v in event_data.model_dump().items() if v is not None}
    try:
        updated = await service.update_event_with_images(
            event_id,
            str(current_user.id),
            image_manifest=image_manifest,
            image_uploads=image_uploads,
            **update_data,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error))

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event not editable or invalid update",
        )

    return _model_to_response(updated)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    current_user: CurrentUserResponse = Depends(_organizer_required),
    session: Session = Depends(get_session),
):
    """Delete a draft event."""
    service = _get_event_service(session)

    if not service.delete_event(event_id, str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete non-draft or unauthorized event",
        )


@router.post("/{event_id}/submit", response_model=EventUpdateResponse)
async def submit_event(
    event_id: str,
    current_user: CurrentUserResponse = Depends(_organizer_required),
    session: Session = Depends(get_session),
):
    """Submit a draft event for admin review."""
    service = _get_event_service(session)

    if not service.submit_event(event_id, str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event cannot be submitted",
        )

    event = service._event_repo.get_by_id(event_id)
    return _model_to_response(event)


@router.post("/{event_id}/cancel", response_model=EventUpdateResponse)
async def cancel_submission(
    event_id: str,
    current_user: CurrentUserResponse = Depends(_organizer_required),
    session: Session = Depends(get_session),
):
    """Cancel a pending event submission and return to draft."""
    service = _get_event_service(session)

    if not service.cancel_submission(event_id, str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event cannot be cancelled",
        )

    event = service._event_repo.get_by_id(event_id)
    return _model_to_response(event)
