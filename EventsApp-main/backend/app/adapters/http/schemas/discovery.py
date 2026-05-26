"""Response schemas for student-facing event discovery endpoints."""

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field

from app.application.users.dto import PublicUserSummaryResponse


class EventCoverThumbnail(BaseModel):
    id: str
    thumbnail_url: str
    width: int
    height: int


class EventGalleryImage(BaseModel):
    id: str
    position: int
    original_url: str
    display_url: str
    thumbnail_url: str
    width: int
    height: int


class DiscoveryEventSummary(BaseModel):
    """Public event view returned to any authenticated user."""
    id: str
    title: str
    description: str
    date_time: datetime
    location: str
    capacity: int
    registrations_count: int
    organizer_id: str
    status: str
    created_at: datetime
    submitted_at: datetime | None = None
    categories: list[str] = Field(default_factory=list)
    organizer: PublicUserSummaryResponse | None = None
    is_registered: bool = False
    cover_image: EventCoverThumbnail | None = None


class DiscoveryEventDetail(DiscoveryEventSummary):
    gallery_images: list[EventGalleryImage] = Field(default_factory=list)


class RegisteredEventResponse(DiscoveryEventDetail):
    registered_at: datetime
