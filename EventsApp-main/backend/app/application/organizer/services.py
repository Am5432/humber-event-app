"""Organizer event service for creating, managing, and submitting events."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import UploadFile

from app.adapters.persistence.repositories import EventRepository, CategoryRepository
from app.adapters.persistence.models import EventModel, CategoryModel
from app.adapters.http.schemas.events import OrganizerImageManifestItem
from app.application.organizer.image_service import OrganizerEventImageService
from app.domain.events.entities import Event, Category


class OrganizerEventService:
    """Application service for organizer event management."""

    def __init__(
        self,
        event_repo: EventRepository,
        category_repo: Optional[CategoryRepository] = None,
        image_service: OrganizerEventImageService | None = None,
    ) -> None:
        self._event_repo = event_repo
        self._category_repo = category_repo
        self._image_service = image_service

    def _resolve_categories(self, category_ids: list[str]) -> list[CategoryModel]:
        categories: list[CategoryModel] = []
        if self._category_repo:
            for cat_id in category_ids:
                cat = self._category_repo.get_by_id(cat_id)
                if cat is not None:
                    categories.append(cat)
        return categories

    def create_event(
        self,
        organizer_id: str,
        title: str,
        description: str,
        date_time: datetime,
        location: str,
        capacity: int,
        category_ids: list[str],
    ) -> EventModel:
        """Create a new event in draft status."""
        return self._event_repo.create(
            organizer_id=organizer_id,
            title=title,
            description=description,
            date_time=date_time,
            location=location,
            capacity=capacity,
            categories=self._resolve_categories(category_ids),
        )

    async def create_event_with_images(
        self,
        organizer_id: str,
        title: str,
        description: str,
        date_time: datetime,
        location: str,
        capacity: int,
        category_ids: list[str],
        *,
        image_manifest: list[OrganizerImageManifestItem] | None = None,
        image_uploads: dict[str, UploadFile] | None = None,
    ) -> EventModel:
        image_manifest = image_manifest or []
        image_uploads = image_uploads or {}
        categories = self._resolve_categories(category_ids)
        use_image_sync = self._image_service is not None and (
            image_manifest or image_uploads
        )
        event = self._event_repo.create(
            organizer_id=organizer_id,
            title=title,
            description=description,
            date_time=date_time,
            location=location,
            capacity=capacity,
            categories=categories,
            commit=not use_image_sync,
        )
        if not use_image_sync or self._image_service is None:
            return event

        cleanup = await self._image_service.sync_event_images(
            event=event,
            image_manifest=image_manifest,
            image_uploads=image_uploads,
        )
        try:
            self._event_repo._session.commit()
        except Exception:
            self._event_repo._session.rollback()
            self._image_service.cleanup_created_images(event.id, cleanup.created_image_ids)
            raise
        self._image_service.cleanup_removed_images(event.id, cleanup.removed_image_ids)
        self._event_repo._session.refresh(event)
        return event

    def update_event(
        self,
        event_id: str,
        organizer_id: str,
        **kwargs,
    ) -> Optional[EventModel]:
        """Update an event if the caller is the owner and event is editable."""
        if "category_ids" in kwargs and self._category_repo:
            category_ids = kwargs.pop("category_ids")
            categories = []
            for cat_id in category_ids:
                cat = self._category_repo.get_by_id(cat_id)
                if cat is not None:
                    categories.append(cat)
            kwargs["categories"] = categories
        return self._event_repo.update(event_id, organizer_id, **kwargs)

    async def update_event_with_images(
        self,
        event_id: str,
        organizer_id: str,
        *,
        image_manifest: list[OrganizerImageManifestItem] | None = None,
        image_uploads: dict[str, UploadFile] | None = None,
        **kwargs,
    ) -> Optional[EventModel]:
        existing_event = self._event_repo.get_by_id(event_id)
        if existing_event is None:
            return None
        if existing_event.organizer_id != organizer_id:
            raise PermissionError("Not authorized")

        if "category_ids" in kwargs and self._category_repo:
            category_ids = kwargs.pop("category_ids")
            kwargs["categories"] = self._resolve_categories(category_ids)

        if image_manifest is None or self._image_service is None:
            return self._event_repo.update(event_id, organizer_id, **kwargs)

        updated_event = self._event_repo.update(
            event_id,
            organizer_id,
            commit=False,
            **kwargs,
        )
        if updated_event is None:
            return None

        cleanup = await self._image_service.sync_event_images(
            event=updated_event,
            image_manifest=image_manifest,
            image_uploads=image_uploads or {},
        )
        try:
            self._event_repo._session.commit()
        except Exception:
            self._event_repo._session.rollback()
            self._image_service.cleanup_created_images(
                updated_event.id,
                cleanup.created_image_ids,
            )
            raise
        self._image_service.cleanup_removed_images(
            updated_event.id,
            cleanup.removed_image_ids,
        )
        self._event_repo._session.refresh(updated_event)
        return updated_event

    def submit_event(self, event_id: str, organizer_id: str) -> bool:
        """Submit a draft event to pending review."""
        event = self._event_repo.get_by_id(event_id)
        if not event or event.organizer_id != organizer_id or event.status != "draft":
            return False

        # Validate required fields
        if (
            not event.title
            or not event.description
            or not event.location
            or event.capacity <= 0
            or not event.categories
        ):
            return False

        event.status = "pending"
        event.submitted_at = datetime.now(timezone.utc)
        self._event_repo._session.commit()
        self._event_repo._session.refresh(event)
        return True

    def cancel_submission(self, event_id: str, organizer_id: str) -> bool:
        """Cancel a pending event submission and reset to draft."""
        event = self._event_repo.get_by_id(event_id)
        if not event or event.organizer_id != organizer_id or event.status != "pending":
            return False

        event.status = "draft"
        event.submitted_at = None
        self._event_repo._session.commit()
        self._event_repo._session.refresh(event)
        return True

    def reject_event(self, event_id: str, organizer_id: str) -> bool:
        """Reject a pending event and return it to draft status."""
        event = self._event_repo.get_by_id(event_id)
        if not event or event.organizer_id != organizer_id or event.status != "pending":
            return False

        event.status = "draft"
        self._event_repo._session.commit()
        self._event_repo._session.refresh(event)
        return True

    def delete_event(self, event_id: str, organizer_id: str) -> bool:
        """Delete an event if the caller is the owner and event is a draft."""
        return self._event_repo.delete(event_id, organizer_id)
