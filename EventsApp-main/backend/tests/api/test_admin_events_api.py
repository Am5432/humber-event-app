"""API tests for admin event moderation endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.adapters.auth.interfaces import VerifiedIdentity
from app.adapters.auth.mock import MockAuthProvider
from app.adapters.persistence.models import CategoryModel, EventModel
from app.adapters.persistence.repositories import UserRepository
from app.domain.users.entities import UserRole


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_provider() -> MockAuthProvider:
    provider = MockAuthProvider()
    provider.seed_token(
        "admin-token",
        VerifiedIdentity(
            provider="mock",
            external_uid="mock-admin-001",
            email="admin@humber.ca",
            display_name="Dev Admin",
            role="admin",
        ),
    )
    provider.seed_token(
        "organizer-token",
        VerifiedIdentity(
            provider="mock",
            external_uid="mock-organizer-001",
            email="organizer@humber.ca",
            display_name="Dev Organizer",
            role="organizer",
        ),
    )
    provider.seed_token(
        "student-token",
        VerifiedIdentity(
            provider="mock",
            external_uid="mock-student-001",
            email="student@humber.ca",
            display_name="Dev Student",
            role="student",
        ),
    )
    return provider


@pytest.fixture
def admin_app(
    app: FastAPI,
    mock_provider: MockAuthProvider,
    db_session: Session,
    override_auth_dependency,
) -> FastAPI:
    override_auth_dependency(mock_provider)

    repo = UserRepository(db_session)
    repo.create_user(
        email="admin@humber.ca",
        display_name="Dev Admin",
        role=UserRole.ADMIN,
    )
    organizer = repo.create_user(
        email="organizer@humber.ca",
        display_name="Dev Organizer",
        role=UserRole.ORGANIZER,
    )
    repo.create_user(
        email="student@humber.ca",
        display_name="Dev Student",
        role=UserRole.STUDENT,
    )

    category = CategoryModel(
        id="cat-academic",
        name="Academic",
        description="Academic events",
    )
    db_session.add(category)

    pending_event = EventModel(
        id="evt-pending",
        title="Pending Event",
        description="Awaiting moderation",
        date_time=datetime(2027, 6, 15, 10, 0, 0, tzinfo=timezone.utc),
        location="North Campus",
        capacity=50,
        organizer_id=str(organizer.id),
        status="pending",
        submitted_at=datetime(2027, 6, 1, 12, 0, 0, tzinfo=timezone.utc),
    )
    pending_event.categories.append(category)

    approved_event = EventModel(
        id="evt-approved",
        title="Approved Event",
        description="Already approved",
        date_time=datetime(2027, 6, 20, 10, 0, 0, tzinfo=timezone.utc),
        location="Lakeshore",
        capacity=40,
        organizer_id=str(organizer.id),
        status="approved",
    )
    approved_event.categories.append(category)

    rejected_event = EventModel(
        id="evt-rejected",
        title="Rejected Event",
        description="Already rejected",
        date_time=datetime(2027, 6, 21, 10, 0, 0, tzinfo=timezone.utc),
        location="Downtown",
        capacity=20,
        organizer_id=str(organizer.id),
        status="rejected",
        rejection_reason="Conflicts with policy",
    )
    rejected_event.categories.append(category)

    db_session.add_all([pending_event, approved_event, rejected_event])
    db_session.commit()

    return app


@pytest.fixture
def admin_client(admin_app: FastAPI) -> Generator[TestClient, None, None]:
    with TestClient(admin_app) as client:
        yield client


def test_admin_can_list_pending_events(admin_client: TestClient) -> None:
    response = admin_client.get("/admin/events", headers=_auth("admin-token"))

    assert response.status_code == 200
    body = response.json()
    assert [event["id"] for event in body] == ["evt-pending"]


def test_admin_can_view_analytics_summary(admin_client: TestClient) -> None:
    response = admin_client.get(
        "/admin/events/analytics",
        headers=_auth("admin-token"),
    )

    assert response.status_code == 200
    assert response.json() == {
        "total_events": 3,
        "approved_events": 1,
        "pending_events": 1,
        "rejected_events": 1,
        "total_registrations": 0,
        "total_users": 3,
        "student_users": 1,
        "organizer_users": 1,
        "admin_users": 1,
    }


def test_admin_can_approve_pending_event(admin_client: TestClient) -> None:
    response = admin_client.post(
        "/admin/events/evt-pending/approve",
        headers=_auth("admin-token"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "approved"
    assert body["rejection_reason"] is None


def test_admin_can_reject_pending_event(admin_client: TestClient) -> None:
    response = admin_client.post(
        "/admin/events/evt-pending/reject",
        headers=_auth("admin-token"),
        json={"reason": "Missing required details"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "rejected"
    assert body["rejection_reason"] == "Missing required details"


def test_approve_non_pending_event_returns_conflict(admin_client: TestClient) -> None:
    response = admin_client.post(
        "/admin/events/evt-approved/approve",
        headers=_auth("admin-token"),
    )

    assert response.status_code == 409
    assert "approved" in response.json()["detail"]


def test_reject_non_pending_event_returns_conflict(admin_client: TestClient) -> None:
    response = admin_client.post(
        "/admin/events/evt-rejected/reject",
        headers=_auth("admin-token"),
        json={"reason": "Still invalid"},
    )

    assert response.status_code == 409
    assert "rejected" in response.json()["detail"]


def test_non_admin_cannot_access_admin_routes(admin_client: TestClient) -> None:
    list_response = admin_client.get("/admin/events", headers=_auth("organizer-token"))
    approve_response = admin_client.post(
        "/admin/events/evt-pending/approve",
        headers=_auth("student-token"),
    )

    assert list_response.status_code == 403
    assert approve_response.status_code == 403
