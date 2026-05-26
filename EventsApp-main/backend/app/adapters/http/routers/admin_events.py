"""Admin event moderation endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.adapters.http.dependencies import get_session, require_roles
from app.adapters.http.schemas.events import (
    AdminRejectRequest,
    OrganizerEventResponse,
)
from app.adapters.persistence.repositories import EventRepository
from app.application.admin.services import AdminEventService
from app.application.users.dto import CurrentUserResponse


router = APIRouter(prefix="/admin/events", tags=["Admin Events"])

_admin_required = require_roles("admin")


def _get_admin_service(session: Session) -> AdminEventService:
    return AdminEventService(event_repo=EventRepository(session))


def _model_to_response(model) -> dict:
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
    }


@router.get("", response_model=List[OrganizerEventResponse])
async def list_pending_events(
    status_filter: str = Query("pending", alias="status"),
    current_user: CurrentUserResponse = Depends(_admin_required),
    session: Session = Depends(get_session),
):
    del current_user
    service = _get_admin_service(session)
    if status_filter != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending event listing is supported.",
        )
    return [_model_to_response(event) for event in service.list_pending()]


@router.post("/{event_id}/approve", response_model=OrganizerEventResponse)
async def approve_event(
    event_id: str,
    current_user: CurrentUserResponse = Depends(_admin_required),
    session: Session = Depends(get_session),
):
    del current_user
    service = _get_admin_service(session)
    try:
        event = service.approve_event(event_id)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    return _model_to_response(event)


@router.post("/{event_id}/reject", response_model=OrganizerEventResponse)
async def reject_event(
    event_id: str,
    payload: AdminRejectRequest,
    current_user: CurrentUserResponse = Depends(_admin_required),
    session: Session = Depends(get_session),
):
    del current_user
    service = _get_admin_service(session)
    try:
        event = service.reject_event(event_id, payload.reason)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    return _model_to_response(event)


@router.get("/analytics")
async def analytics_summary(
    current_user: CurrentUserResponse = Depends(_admin_required),
    session: Session = Depends(get_session),
):
    del current_user
    service = _get_admin_service(session)
    return service.analytics_summary()
