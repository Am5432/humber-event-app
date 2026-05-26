from dataclasses import dataclass, field
from datetime import datetime
from typing import List
import uuid

@dataclass(frozen=True, slots=True)
class Category:
    """Domain entity for event categories."""
    id: str
    name: str
    description: str | None = None
    
    @property
    def display_name(self) -> str:
        """Return the category name for display."""
        return self.name

@dataclass(frozen=True, slots=True)
class Event:
    """Domain entity representing an event."""
    id: str
    title: str
    description: str
    date_time: datetime
    location: str
    capacity: int
    organizer_id: str
    status: str
    created_at: datetime
    categories: List[Category] = field(default_factory=list)
    
    @property
    def has_categories(self) -> bool:
        """Check if event has at least one category."""
        return len(self.categories) > 0
    
    @property
    def is_eligible_for_submission(self) -> bool:
        """Check if event is a draft for submission."""
        return self.status == "draft"
    
    @property
    def is_editable(self) -> bool:
        """Check if event can be edited (only draft or rejected)."""
        return self.status in ("draft", "rejected")

@dataclass(frozen=True, slots=True)
class EventCategory:
    """Domain entity for event-category relationship."""
    event_id: str
    category_id: str
    created_at: datetime
