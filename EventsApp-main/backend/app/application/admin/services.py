"""Admin event moderation service."""

from __future__ import annotations

from app.adapters.persistence.models import EventModel
from app.adapters.persistence.repositories import EventRepository


class AdminEventService:
    """Application service for admin event moderation."""

    def __init__(self, event_repo: EventRepository) -> None:
        self._event_repo = event_repo

    def list_pending(self) -> list[EventModel]:
        """Return all events awaiting moderation."""
        return self._event_repo.list_pending()

    def analytics_summary(self) -> dict[str, int]:
        """Return aggregate counts for the admin dashboard."""
        return self._event_repo.analytics_summary()

    def approve_event(self, event_id: str) -> EventModel:
        """Approve a pending event."""
        event = self._event_repo.get_by_id(event_id)
        if not event:
            raise ValueError(f"Event '{event_id}' not found.")
        if event.status != "pending":
            raise ValueError(
                f"Cannot approve event with status '{event.status}'. "
                "Only pending events can be approved."
            )
        approved = self._event_repo.update_status(event_id, "approved")
        if approved is None:
            raise ValueError(f"Event '{event_id}' not found.")
        return approved

    def reject_event(self, event_id: str, reason: str) -> EventModel:
        """Reject a pending event and store the moderation reason."""
        event = self._event_repo.get_by_id(event_id)
        if not event:
            raise ValueError(f"Event '{event_id}' not found.")
        if event.status != "pending":
            raise ValueError(
                f"Cannot reject event with status '{event.status}'. "
                "Only pending events can be rejected."
            )
        rejected = self._event_repo.update_status(
            event_id,
            "rejected",
            rejection_reason=reason,
        )
        if rejected is None:
            raise ValueError(f"Event '{event_id}' not found.")
        return rejected
