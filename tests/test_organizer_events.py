"""
Comprehensive API tests for organizer event lifecycle endpoints.

Covers:
- CRUD operations (create, list, get, update, delete)
- Ownership enforcement (own event vs another organizer's event)
- Submit event: draft -> pending transition
- Cancel submission: pending -> draft transition
- Category validation on creation and submission
- Edge cases: editing approved events, full capacity
"""

from __future__ import annotations

from typing import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.adapters.auth.interfaces import VerifiedIdentity
from app.adapters.auth.mock import MockAuthProvider
from app.adapters.persistence.models import CategoryModel, EventModel
from tests.fixtures.events import (
    CAT_ACADEMIC,
    CAT_SPORTS,
    ORGANIZER_EMAIL,
    ORGANIZER_TOKEN,
    ORGANIZER_UID,
    OTHER_ORGANIZER_EMAIL,
    OTHER_ORGANIZER_TOKEN,
    OTHER_ORGANIZER_UID,
    STUDENT_EMAIL,
    STUDENT_TOKEN,
    STUDENT_UID,
    draft_event_payload,
    submittable_event_payload,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_provider() -> MockAuthProvider:
    provider = MockAuthProvider()
    provider.seed_token(
        ORGANIZER_TOKEN,
        VerifiedIdentity(
            provider="mock",
            external_uid=ORGANIZER_UID,
            email=ORGANIZER_EMAIL,
            display_name="Test Organizer",
            role="organizer",
        ),
    )
    provider.seed_token(
        OTHER_ORGANIZER_TOKEN,
        VerifiedIdentity(
            provider="mock",
            external_uid=OTHER_ORGANIZER_UID,
            email=OTHER_ORGANIZER_EMAIL,
            display_name="Other Organizer",
            role="organizer",
        ),
    )
    provider.seed_token(
        STUDENT_TOKEN,
        VerifiedIdentity(
            provider="mock",
            external_uid=STUDENT_UID,
            email=STUDENT_EMAIL,
            display_name="Test Student",
            role="student",
        ),
    )
    return provider


@pytest.fixture
def seeded_app(
    app: FastAPI,
    mock_provider: MockAuthProvider,
    db_session: Session,
    override_auth_dependency,
) -> FastAPI:
    """App with auth override and two categories pre-seeded."""
    override_auth_dependency(mock_provider)

    # Seed two categories directly (migrations don't run in test setup)
    for cat_id, name, desc in [
        (CAT_ACADEMIC, "Academic", "Academic campus events"),
        (CAT_SPORTS, "Sports & Recreation", "Sports and recreation events"),
    ]:
        db_session.add(CategoryModel(id=cat_id, name=name, description=desc))
    db_session.commit()

    return app


@pytest.fixture
def org_client(seeded_app: FastAPI) -> Generator[TestClient, None, None]:
    with TestClient(seeded_app) as c:
        yield c


def _create_event(client: TestClient, token: str = ORGANIZER_TOKEN, **overrides) -> dict:
    """Helper to create a draft event and return the response body."""
    payload = draft_event_payload(**overrides)
    resp = client.post(
        "/organizer/events",
        headers=_auth(token),
        json=payload,
    )
    assert resp.status_code == 201, f"Unexpected status {resp.status_code}: {resp.json()}"
    return resp.json()


# ===========================================================================
# Task 1: Submit event tests (EVNT-05 – draft -> pending lifecycle)
# ===========================================================================


class TestSubmitEvent:
    def test_organizer_can_submit_draft_event(self, org_client: TestClient) -> None:
        """A valid draft event transitions to pending on submit."""
        event = _create_event(org_client, title="Submit Me")
        event_id = event["id"]
        assert event["status"] == "draft"

        resp = org_client.post(
            f"/organizer/events/{event_id}/submit",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "pending"
        assert body["id"] == event_id

    def test_submit_sets_submitted_at_timestamp(self, org_client: TestClient) -> None:
        """Submitting an event records a submitted_at timestamp."""
        event = _create_event(org_client, title="Timestamped Event")
        event_id = event["id"]

        resp = org_client.post(
            f"/organizer/events/{event_id}/submit",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["submitted_at"] is not None

    def test_cannot_submit_another_organizers_event(
        self, org_client: TestClient
    ) -> None:
        """Submitting another organizer's event returns 400."""
        event = _create_event(org_client, title="Owned Event")
        event_id = event["id"]

        resp = org_client.post(
            f"/organizer/events/{event_id}/submit",
            headers=_auth(OTHER_ORGANIZER_TOKEN),
        )
        assert resp.status_code == 400

    def test_cannot_submit_nonexistent_event(self, org_client: TestClient) -> None:
        """Submitting a nonexistent event returns 400."""
        resp = org_client.post(
            "/organizer/events/does-not-exist/submit",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 400

    def test_cannot_submit_already_pending_event(self, org_client: TestClient) -> None:
        """Submitting an already-pending event is rejected."""
        event = _create_event(org_client, title="Pending Event")
        event_id = event["id"]

        # First submit succeeds
        resp = org_client.post(
            f"/organizer/events/{event_id}/submit",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 200

        # Second submit fails — status is no longer draft
        resp = org_client.post(
            f"/organizer/events/{event_id}/submit",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 400

    def test_submit_requires_categories(self, org_client: TestClient) -> None:
        """An event with no recognised categories cannot be submitted.

        When all category_ids are invalid (no match in DB), the event is
        created with an empty categories list and submit returns 400.
        """
        # Create with an invalid category so categories list ends up empty
        event = _create_event(
            org_client,
            title="No Category Event",
            category_ids=["invalid-cat-id"],
        )
        event_id = event["id"]
        # Categories should be empty because no category matched
        assert event["categories"] == []

        resp = org_client.post(
            f"/organizer/events/{event_id}/submit",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 400

    def test_submit_requires_organizer_role(self, org_client: TestClient) -> None:
        """Students cannot hit the submit endpoint."""
        event = _create_event(org_client, title="Student Cannot Submit")
        event_id = event["id"]

        resp = org_client.post(
            f"/organizer/events/{event_id}/submit",
            headers=_auth(STUDENT_TOKEN),
        )
        assert resp.status_code == 403


# ===========================================================================
# Task 2: Cancel submission tests (pending -> draft lifecycle)
# ===========================================================================


class TestCancelSubmission:
    def _pending_event_id(self, client: TestClient) -> str:
        """Create and submit an event, return its ID."""
        event = _create_event(client, title="For Cancellation")
        event_id = event["id"]
        resp = client.post(
            f"/organizer/events/{event_id}/submit",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 200
        return event_id

    def test_organizer_can_cancel_pending_submission(
        self, org_client: TestClient
    ) -> None:
        """A pending event reverts to draft on cancel."""
        event_id = self._pending_event_id(org_client)

        resp = org_client.post(
            f"/organizer/events/{event_id}/cancel",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "draft"
        assert body["submitted_at"] is None

    def test_cancel_clears_submitted_at(self, org_client: TestClient) -> None:
        """Cancelling a submission clears the submitted_at timestamp."""
        event_id = self._pending_event_id(org_client)

        resp = org_client.post(
            f"/organizer/events/{event_id}/cancel",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 200
        assert resp.json()["submitted_at"] is None

    def test_cannot_cancel_draft_event(self, org_client: TestClient) -> None:
        """Cancelling a draft event (not pending) returns 400."""
        event = _create_event(org_client, title="Draft Cancel")
        event_id = event["id"]

        resp = org_client.post(
            f"/organizer/events/{event_id}/cancel",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 400

    def test_cannot_cancel_another_organizers_submission(
        self, org_client: TestClient
    ) -> None:
        """Another organizer cannot cancel a different organizer's pending event."""
        event_id = self._pending_event_id(org_client)

        resp = org_client.post(
            f"/organizer/events/{event_id}/cancel",
            headers=_auth(OTHER_ORGANIZER_TOKEN),
        )
        assert resp.status_code == 400

    def test_cannot_cancel_nonexistent_event(self, org_client: TestClient) -> None:
        """Cancelling a nonexistent event returns 400."""
        resp = org_client.post(
            "/organizer/events/does-not-exist/cancel",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 400

    def test_submit_cancel_submit_roundtrip(self, org_client: TestClient) -> None:
        """An event can be submitted, cancelled, and re-submitted successfully."""
        event = _create_event(org_client, title="Roundtrip Event")
        event_id = event["id"]

        # Submit
        resp = org_client.post(
            f"/organizer/events/{event_id}/submit",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"

        # Cancel
        resp = org_client.post(
            f"/organizer/events/{event_id}/cancel",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "draft"

        # Re-submit
        resp = org_client.post(
            f"/organizer/events/{event_id}/submit",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"


# ===========================================================================
# Task 3: Category validation tests
# ===========================================================================


class TestCategoryValidation:
    def test_create_event_with_valid_category(self, org_client: TestClient) -> None:
        """Creating an event with a valid category_id populates the category list."""
        resp = org_client.post(
            "/organizer/events",
            headers=_auth(ORGANIZER_TOKEN),
            json=draft_event_payload(title="Categorised Event", category_ids=[CAT_ACADEMIC]),
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "Academic" in body["categories"]

    def test_create_event_with_multiple_categories(self, org_client: TestClient) -> None:
        """Creating an event with multiple valid category_ids includes all categories."""
        resp = org_client.post(
            "/organizer/events",
            headers=_auth(ORGANIZER_TOKEN),
            json=draft_event_payload(
                title="Multi-Category Event",
                category_ids=[CAT_ACADEMIC, CAT_SPORTS],
            ),
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "Academic" in body["categories"]
        assert "Sports & Recreation" in body["categories"]

    def test_invalid_category_id_is_silently_ignored(
        self, org_client: TestClient
    ) -> None:
        """Unknown category_ids are ignored; the event is still created."""
        resp = org_client.post(
            "/organizer/events",
            headers=_auth(ORGANIZER_TOKEN),
            json=draft_event_payload(
                title="Unknown Category",
                category_ids=["nonexistent-category"],
            ),
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["categories"] == []

    def test_submission_fails_when_no_categories_matched(
        self, org_client: TestClient
    ) -> None:
        """An event with no matched categories cannot be submitted."""
        create_resp = org_client.post(
            "/organizer/events",
            headers=_auth(ORGANIZER_TOKEN),
            json=draft_event_payload(
                title="No Category Submit",
                category_ids=["bogus-cat"],
            ),
        )
        assert create_resp.status_code == 201
        event_id = create_resp.json()["id"]

        submit_resp = org_client.post(
            f"/organizer/events/{event_id}/submit",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert submit_resp.status_code == 400

    def test_empty_category_list_in_payload_is_rejected(
        self, org_client: TestClient
    ) -> None:
        """An empty category_ids list is rejected at the schema layer (min 1 required)."""
        resp = org_client.post(
            "/organizer/events",
            headers=_auth(ORGANIZER_TOKEN),
            json=draft_event_payload(title="No Category Draft", category_ids=[]),
        )
        # The schema enforces at least one category_id in the request
        assert resp.status_code == 422


# ===========================================================================
# Task 4: Editing approved/pending events (edge cases)
# ===========================================================================


class TestEditStatusEdgeCases:
    def _submit_event(self, client: TestClient, title: str) -> str:
        """Create and submit an event; return its ID."""
        event = _create_event(client, title=title)
        event_id = event["id"]
        resp = client.post(
            f"/organizer/events/{event_id}/submit",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 200
        return event_id

    def test_cannot_edit_pending_event(self, org_client: TestClient) -> None:
        """Editing a pending event is rejected."""
        event_id = self._submit_event(org_client, "Pending Edit Attempt")

        resp = org_client.patch(
            f"/organizer/events/{event_id}",
            headers=_auth(ORGANIZER_TOKEN),
            json={"title": "Should Fail"},
        )
        assert resp.status_code == 400

    def test_cannot_delete_pending_event(self, org_client: TestClient) -> None:
        """Deleting a pending event is rejected — only drafts are deletable."""
        event_id = self._submit_event(org_client, "Pending Delete Attempt")

        resp = org_client.delete(
            f"/organizer/events/{event_id}",
            headers=_auth(ORGANIZER_TOKEN),
        )
        assert resp.status_code == 400

    def test_editing_draft_event_preserves_draft_status(
        self, org_client: TestClient
    ) -> None:
        """Editing a draft event does not change its status."""
        event = _create_event(org_client, title="Draft Preserve Status")
        event_id = event["id"]

        resp = org_client.patch(
            f"/organizer/events/{event_id}",
            headers=_auth(ORGANIZER_TOKEN),
            json={"title": "Edited Draft"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "draft"

    def test_organizer_can_edit_rejected_event(
        self,
        org_client: TestClient,
        db_session: Session,
    ) -> None:
        """A rejected event (status='rejected') is editable by its organizer."""
        event = _create_event(org_client, title="Rejected Event")
        event_id = event["id"]

        persisted = db_session.get(EventModel, event_id)
        assert persisted is not None
        persisted.status = "rejected"
        persisted.rejection_reason = "Needs changes"
        db_session.commit()

        resp = org_client.patch(
            f"/organizer/events/{event_id}",
            headers=_auth(ORGANIZER_TOKEN),
            json={"title": "Fixed After Rejection"},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Fixed After Rejection"

    def test_approved_event_metadata_update_stays_approved(
        self,
        org_client: TestClient,
        db_session: Session,
    ) -> None:
        """Approved events can update metadata without re-entering review."""
        event = _create_event(org_client, title="Approved Metadata Event", capacity=20)
        event_id = event["id"]

        persisted = db_session.get(EventModel, event_id)
        assert persisted is not None
        persisted.status = "approved"
        db_session.commit()

        resp = org_client.patch(
            f"/organizer/events/{event_id}",
            headers=_auth(ORGANIZER_TOKEN),
            json={
                "title": "Approved Metadata Event v2",
                "description": "Updated copy for an already-approved event.",
                "capacity": 40,
                "category_ids": [CAT_SPORTS],
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "approved"
        assert body["title"] == "Approved Metadata Event v2"
        assert body["description"] == "Updated copy for an already-approved event."
        assert body["capacity"] == 40
        assert body["categories"] == ["Sports & Recreation"]

    def test_approved_event_date_time_change_returns_to_pending(
        self,
        org_client: TestClient,
        db_session: Session,
    ) -> None:
        """Changing the schedule on an approved event requires re-approval."""
        event = _create_event(org_client, title="Approved Schedule Event")
        event_id = event["id"]

        persisted = db_session.get(EventModel, event_id)
        assert persisted is not None
        persisted.status = "approved"
        persisted.submitted_at = None
        db_session.commit()

        resp = org_client.patch(
            f"/organizer/events/{event_id}",
            headers=_auth(ORGANIZER_TOKEN),
            json={"date_time": "2027-10-05T18:30:00Z"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "pending"
        assert body["date_time"].startswith("2027-10-05T18:30:00")
        assert body["submitted_at"] is not None

    def test_approved_event_location_change_returns_to_pending(
        self,
        org_client: TestClient,
        db_session: Session,
    ) -> None:
        """Changing the location on an approved event requires re-approval."""
        event = _create_event(org_client, title="Approved Location Event")
        event_id = event["id"]

        persisted = db_session.get(EventModel, event_id)
        assert persisted is not None
        persisted.status = "approved"
        db_session.commit()

        resp = org_client.patch(
            f"/organizer/events/{event_id}",
            headers=_auth(ORGANIZER_TOKEN),
            json={"location": "Lakeshore Campus, Student Centre"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "pending"
        assert body["location"] == "Lakeshore Campus, Student Centre"


# ===========================================================================
# Task 5: Capacity edge cases
# ===========================================================================


class TestCapacityEdgeCases:
    def test_create_event_with_minimum_capacity(self, org_client: TestClient) -> None:
        """An event can be created with capacity=1 (minimum valid value)."""
        resp = org_client.post(
            "/organizer/events",
            headers=_auth(ORGANIZER_TOKEN),
            json=draft_event_payload(title="Tiny Event", capacity=1),
        )
        assert resp.status_code == 201
        assert resp.json()["capacity"] == 1

    def test_create_event_rejects_zero_capacity(self, org_client: TestClient) -> None:
        """Capacity of 0 is rejected by schema validation."""
        resp = org_client.post(
            "/organizer/events",
            headers=_auth(ORGANIZER_TOKEN),
            json=draft_event_payload(title="Zero Cap", capacity=0),
        )
        assert resp.status_code == 422

    def test_create_event_rejects_negative_capacity(self, org_client: TestClient) -> None:
        """Negative capacity is rejected by schema validation."""
        resp = org_client.post(
            "/organizer/events",
            headers=_auth(ORGANIZER_TOKEN),
            json=draft_event_payload(title="Negative Cap", capacity=-10),
        )
        assert resp.status_code == 422

    def test_update_event_capacity(self, org_client: TestClient) -> None:
        """Organizer can update the capacity of a draft event."""
        event = _create_event(org_client, title="Expand Capacity", capacity=20)
        event_id = event["id"]

        resp = org_client.patch(
            f"/organizer/events/{event_id}",
            headers=_auth(ORGANIZER_TOKEN),
            json={"capacity": 200},
        )
        assert resp.status_code == 200
        assert resp.json()["capacity"] == 200
