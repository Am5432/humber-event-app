"""Unit tests for AdminEventService."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.adapters.persistence.models import EventModel
from app.adapters.persistence.repositories import EventRepository
from app.application.admin.services import AdminEventService


def _make_event(db_session, event_id: str, status: str) -> EventModel:
    event = EventModel(
        id=event_id,
        title=f"Event {event_id}",
        description="Description",
        date_time=datetime(2027, 6, 15, 10, 0, 0, tzinfo=timezone.utc),
        location="North Campus",
        capacity=50,
        organizer_id="org-1",
        status=status,
    )
    db_session.add(event)
    db_session.commit()
    return event


def _get_service(db_session) -> AdminEventService:
    return AdminEventService(event_repo=EventRepository(db_session))


def test_list_pending_returns_only_pending_events(db_session) -> None:
    _make_event(db_session, "evt-pending", "pending")
    _make_event(db_session, "evt-approved", "approved")

    results = _get_service(db_session).list_pending()

    assert [event.id for event in results] == ["evt-pending"]


def test_approve_pending_event_transitions_to_approved(db_session) -> None:
    _make_event(db_session, "evt-approve", "pending")

    event = _get_service(db_session).approve_event("evt-approve")

    assert event.status == "approved"
    assert event.rejection_reason is None


def test_approve_non_pending_raises_value_error(db_session) -> None:
    _make_event(db_session, "evt-draft", "draft")

    with pytest.raises(ValueError, match="pending events can be approved"):
        _get_service(db_session).approve_event("evt-draft")


def test_approve_already_approved_raises_value_error(db_session) -> None:
    _make_event(db_session, "evt-approved", "approved")

    with pytest.raises(ValueError, match="status 'approved'"):
        _get_service(db_session).approve_event("evt-approved")


def test_reject_pending_event_sets_reason(db_session) -> None:
    _make_event(db_session, "evt-reject", "pending")

    event = _get_service(db_session).reject_event("evt-reject", "violates policy")

    assert event.status == "rejected"
    assert event.rejection_reason == "violates policy"


def test_reject_non_pending_raises_value_error(db_session) -> None:
    _make_event(db_session, "evt-draft-reject", "draft")

    with pytest.raises(ValueError, match="pending events can be rejected"):
        _get_service(db_session).reject_event("evt-draft-reject", "nope")


def test_reject_already_rejected_raises_value_error(db_session) -> None:
    event = _make_event(db_session, "evt-rejected", "rejected")
    event.rejection_reason = "existing reason"
    db_session.commit()

    with pytest.raises(ValueError, match="status 'rejected'"):
        _get_service(db_session).reject_event("evt-rejected", "updated reason")
