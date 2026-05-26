"""Discovery service for student-facing event browsing."""

from __future__ import annotations

from app.adapters.persistence.models import EventModel
from app.adapters.persistence.repositories import EventRepository


class DiscoveryService:
    """Application service for approved event discovery."""

    def __init__(self, event_repo: EventRepository) -> None:
        self._event_repo = event_repo

    def list_approved(
        self,
        q: str | None = None,
        category: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        location: str | None = None,
    ) -> list[EventModel]:
        """Return approved events matching the given filters."""
        return self._event_repo.list_approved(
            q=q,
            category=category,
            date_from=date_from,
            date_to=date_to,
            location=location,
        )

    def get_approved_event(self, event_id: str) -> EventModel | None:
        """Return a single approved event if it is publicly visible."""
        event = self._event_repo.get_by_id(event_id)
        if event is None or event.status != "approved":
            return None
        return event
