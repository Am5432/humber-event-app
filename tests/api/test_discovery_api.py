"""API tests for student-facing discovery endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.adapters.auth.interfaces import VerifiedIdentity
from app.adapters.auth.mock import MockAuthProvider
from app.adapters.persistence.models import CategoryModel, EventImageModel, EventModel
from app.adapters.persistence.repositories import UserRepository
from app.domain.users.entities import UserRole


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_provider() -> MockAuthProvider:
    provider = MockAuthProvider()
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
        "admin-token",
        VerifiedIdentity(
            provider="mock",
            external_uid="mock-admin-001",
            email="admin@humber.ca",
            display_name="Dev Admin",
            role="admin",
        ),
    )
    return provider


@pytest.fixture
def discovery_app(
    app: FastAPI,
    mock_provider: MockAuthProvider,
    db_session: Session,
    override_auth_dependency,
) -> FastAPI:
    override_auth_dependency(mock_provider)

    repo = UserRepository(db_session)
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
    repo.create_user(
        email="admin@humber.ca",
        display_name="Dev Admin",
        role=UserRole.ADMIN,
    )

    academic = CategoryModel(
        id="cat-academic",
        name="Academic",
        description="Academic events",
    )
    arts = CategoryModel(
        id="cat-arts",
        name="Arts & Culture",
        description="Arts events",
    )
    db_session.add_all([academic, arts])

    approved_one = EventModel(
        id="evt-approved-1",
        title="AI Expo",
        description="Technology showcase for Humber students",
        date_time=datetime(2027, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
        location="North Campus",
        capacity=100,
        registrations_count=24,
        organizer_id=str(organizer.id),
        status="approved",
        submitted_at=datetime(2027, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
    )
    approved_one.categories.append(academic)
    approved_one.images = [
        EventImageModel(
            id="img-cover-1",
            event_id="evt-approved-1",
            sort_order=0,
            original_filename="cover.jpg",
            content_type="image/jpeg",
            file_size_bytes=1024,
            width=1600,
            height=900,
            original_url="/media/events/evt-approved-1/img-cover-1/original.jpg",
            display_url="/media/events/evt-approved-1/img-cover-1/display.jpg",
            thumbnail_url="/media/events/evt-approved-1/img-cover-1/thumbnail.jpg",
        ),
        EventImageModel(
            id="img-gallery-2",
            event_id="evt-approved-1",
            sort_order=1,
            original_filename="gallery.jpg",
            content_type="image/jpeg",
            file_size_bytes=1024,
            width=1600,
            height=900,
            original_url="/media/events/evt-approved-1/img-gallery-2/original.jpg",
            display_url="/media/events/evt-approved-1/img-gallery-2/display.jpg",
            thumbnail_url="/media/events/evt-approved-1/img-gallery-2/thumbnail.jpg",
        ),
    ]

    approved_two = EventModel(
        id="evt-approved-2",
        title="Gallery Night",
        description="Campus art and music showcase",
        date_time=datetime(2027, 3, 20, 18, 0, 0, tzinfo=timezone.utc),
        location="Lakeshore Campus",
        capacity=80,
        registrations_count=9,
        organizer_id=str(organizer.id),
        status="approved",
        submitted_at=datetime(2027, 3, 1, 12, 0, 0, tzinfo=timezone.utc),
    )
    approved_two.categories.append(arts)

    pending_event = EventModel(
        id="evt-pending",
        title="Pending Meetup",
        description="Should not be discoverable",
        date_time=datetime(2027, 4, 5, 17, 0, 0, tzinfo=timezone.utc),
        location="Downtown",
        capacity=25,
        organizer_id=str(organizer.id),
        status="pending",
    )
    pending_event.categories.append(academic)

    db_session.add_all([approved_one, approved_two, pending_event])
    db_session.commit()

    return app


@pytest.fixture
def discovery_client(discovery_app: FastAPI) -> Generator[TestClient, None, None]:
    with TestClient(discovery_app) as client:
        yield client


def test_list_approved_events_no_filters(discovery_client: TestClient) -> None:
    response = discovery_client.get("/events", headers=_auth("student-token"))

    assert response.status_code == 200
    body = response.json()
    assert [event["id"] for event in body] == [
        "evt-approved-1",
        "evt-approved-2",
    ]
    assert body[0]["registrations_count"] == 24
    assert body[0]["organizer"]["display_name"] == "Dev Organizer"
    assert body[0]["is_registered"] is False
    assert body[0]["cover_image"]["thumbnail_url"].startswith("/media/")
    assert "gallery_images" not in body[0]
    assert body[1]["cover_image"] is None


def test_keyword_search_filters_results(discovery_client: TestClient) -> None:
    response = discovery_client.get(
        "/events?q=technology",
        headers=_auth("student-token"),
    )

    assert response.status_code == 200
    assert [event["id"] for event in response.json()] == ["evt-approved-1"]


def test_category_filter_returns_matching_events(discovery_client: TestClient) -> None:
    response = discovery_client.get(
        "/events",
        params={"category": "Arts & Culture"},
        headers=_auth("student-token"),
    )

    assert response.status_code == 200
    assert [event["id"] for event in response.json()] == ["evt-approved-2"]


def test_date_filter_returns_events_in_range(discovery_client: TestClient) -> None:
    response = discovery_client.get(
        "/events",
        params={"date_from": "2027-03-01", "date_to": "2027-03-31"},
        headers=_auth("student-token"),
    )

    assert response.status_code == 200
    assert [event["id"] for event in response.json()] == ["evt-approved-2"]


def test_location_filter_returns_matching_events(discovery_client: TestClient) -> None:
    response = discovery_client.get(
        "/events?location=north",
        headers=_auth("student-token"),
    )

    assert response.status_code == 200
    assert [event["id"] for event in response.json()] == ["evt-approved-1"]


def test_combined_filters_are_supported(discovery_client: TestClient) -> None:
    response = discovery_client.get(
        "/events",
        params={
            "q": "campus",
            "category": "Arts & Culture",
            "date_from": "2027-03-01",
            "date_to": "2027-03-31",
            "location": "shore",
        },
        headers=_auth("student-token"),
    )

    assert response.status_code == 200
    assert [event["id"] for event in response.json()] == ["evt-approved-2"]


def test_get_approved_event_returns_event(discovery_client: TestClient) -> None:
    response = discovery_client.get(
        "/events/evt-approved-1",
        headers=_auth("student-token"),
    )

    assert response.status_code == 200
    assert response.json()["id"] == "evt-approved-1"
    assert response.json()["registrations_count"] == 24
    assert response.json()["organizer"]["display_name"] == "Dev Organizer"
    assert response.json()["is_registered"] is False
    assert response.json()["cover_image"]["thumbnail_url"].startswith("/media/")
    assert [image["position"] for image in response.json()["gallery_images"]] == [0, 1]
    assert response.json()["gallery_images"][0]["display_url"].startswith("/media/")


def test_imageless_detail_returns_null_cover_and_empty_gallery(
    discovery_client: TestClient,
) -> None:
    response = discovery_client.get(
        "/events/evt-approved-2",
        headers=_auth("student-token"),
    )

    assert response.status_code == 200
    assert response.json()["cover_image"] is None
    assert response.json()["gallery_images"] == []


def test_register_for_event_increments_registrations(
    discovery_client: TestClient,
) -> None:
    response = discovery_client.post(
        "/events/evt-approved-1/register",
        headers=_auth("student-token"),
    )

    assert response.status_code == 200
    assert response.json()["registrations_count"] == 25
    assert response.json()["is_registered"] is True


def test_deregister_for_event_decrements_registrations(
    discovery_client: TestClient,
) -> None:
    register_response = discovery_client.post(
        "/events/evt-approved-1/register",
        headers=_auth("student-token"),
    )

    assert register_response.status_code == 200

    deregister_response = discovery_client.delete(
        "/events/evt-approved-1/register",
        headers=_auth("student-token"),
    )

    assert deregister_response.status_code == 200
    assert deregister_response.json()["registrations_count"] == 24
    assert deregister_response.json()["is_registered"] is False


def test_get_non_approved_event_returns_not_found(
    discovery_client: TestClient,
) -> None:
    response = discovery_client.get(
        "/events/evt-pending",
        headers=_auth("student-token"),
    )

    assert response.status_code == 404


def test_discovery_requires_authentication(discovery_client: TestClient) -> None:
    list_response = discovery_client.get("/events")
    detail_response = discovery_client.get("/events/evt-approved-1")

    assert list_response.status_code == 401
    assert detail_response.status_code == 401
