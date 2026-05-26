import json
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator


# CreateEventSchema for POST /organizer/events
class CreateEventSchema(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    date_time: datetime
    location: str = Field(..., min_length=1, max_length=500)
    capacity: int = Field(..., ge=1)
    category_ids: List[str] = Field(..., min_length=1, max_length=10)


# UpdateEventSchema for PATCH /organizer/events/{id}
class UpdateEventSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    date_time: Optional[datetime] = None
    location: Optional[str] = Field(None, min_length=1, max_length=500)
    capacity: Optional[int] = Field(None, ge=1)
    category_ids: Optional[List[str]] = None


class EventImageAsset(BaseModel):
    id: str
    position: int
    original_url: str
    display_url: str
    thumbnail_url: str
    width: int
    height: int


class OrganizerImageManifestItem(BaseModel):
    position: int = Field(ge=0)
    source: Literal["existing", "upload"]
    id: str | None = None
    client_id: str | None = None

    @model_validator(mode="after")
    def validate_reference(self) -> "OrganizerImageManifestItem":
        if self.source == "existing" and not self.id:
            raise ValueError("Existing images require an id.")
        if self.source == "upload" and not self.client_id:
            raise ValueError("Uploaded images require a client_id.")
        return self


def parse_image_manifest_json(raw_manifest: str | None) -> list[OrganizerImageManifestItem]:
    if raw_manifest is None or raw_manifest == "":
        return []
    try:
        parsed = json.loads(raw_manifest)
    except json.JSONDecodeError as error:
        raise ValueError("image_manifest_json must be valid JSON.") from error

    try:
        return TypeAdapter(list[OrganizerImageManifestItem]).validate_python(parsed)
    except Exception as error:  # pragma: no cover - validation error content is surfaced upstream
        raise ValueError("image_manifest_json contains invalid image manifest entries.") from error


class OrganizerEventResponse(BaseModel):
    id: str
    title: str
    description: str
    date_time: datetime
    location: str
    capacity: int
    organizer_id: str
    status: str
    created_at: datetime
    categories: List[str]
    images: List[EventImageAsset] = Field(default_factory=list)
    submitted_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None


# EventUpdateResponse for POST/PATCH responses
class EventUpdateResponse(BaseModel):
    id: str
    title: str
    description: str
    date_time: datetime
    location: str
    capacity: int
    organizer_id: str
    status: str
    created_at: datetime
    submitted_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    categories: List[str] = Field(default_factory=list)
    images: List[EventImageAsset] = Field(default_factory=list)


class AdminRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=1000)
