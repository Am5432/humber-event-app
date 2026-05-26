from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.users.entities import UserRole


class CurrentUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    display_name: str
    role: UserRole


class PublicUserSummaryResponse(BaseModel):
    id: int
    display_name: str
    role: UserRole


class PublicUserProfileResponse(PublicUserSummaryResponse):
    created_at: datetime
    organized_events_count: int = 0
    approved_events_count: int = 0
    registered_events_count: int = 0


class AdminUserResponse(CurrentUserResponse):
    created_at: datetime


class AdminUpdateUserRoleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["student", "organizer", "admin"]


class UpdateProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1, max_length=255)
