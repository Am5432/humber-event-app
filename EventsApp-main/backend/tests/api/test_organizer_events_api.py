"""API tests for organizer event management endpoints."""
from __future__ import annotations

from datetime import datetime, timezone
import json
from typing import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.adapters.auth.interfaces import VerifiedIdentity
from app.adapters.auth.mock import MockAuthProvider
from app.adapters.persistence.models import CategoryModel, EventModel


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _future_dt() -> str:
    return "2027-06-15T10:00:00Z"


def _image_bytes(image_format: str = "PNG") -> bytes:
    from PIL import Image

    from io import BytesIO

    buffer = BytesIO()
    Image.new("RGB", (1200, 800), color=(35, 90, 150)).save(buffer, format=image_format)
    return buffer.getvalue()


def _multipart_form_parts(
    *,
    category_ids: list[str] | None = None,
    image_manifest: list[dict[str, object]] | None = None,
    image_client_ids: list[str] | None = None,
) -> list[tuple[str, tuple[None, str]]]:
    fields = [
        ("title", (None, "Multipart Event")),
        ("description", (None, "Multipart upload event")),
        ("date_time", (None, _future_dt())),
        ("location", (None, "Room 101")),
        ("capacity", (None, "50")),
    ]
    for category_id in category_ids or ["cat-academic"]:
        fields.append(("category_ids", (None, category_id)))
    if image_manifest is not None:
        fields.append(("image_manifest_json", (None, json.dumps(image_manifest))))
    for client_id in image_client_ids or []:
        fields.append(("image_file_client_ids", (None, client_id)))
    return fields


def _upload_file(field_name: str, filename: str, payload: bytes, content_type: str):
    return (field_name, (filename, payload, content_type))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_provider() -> MockAuthProvider:
    provider = MockAuthProvider()
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
        "other-organizer-token",
        VerifiedIdentity(
            provider="mock",
            external_uid="mock-organizer-002",
            email="organizer2@humber.ca",
            display_name="Other Organizer",
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
def seeded_app(
    app: FastAPI,
    mock_provider: MockAuthProvider,
    db_session: Session,
    override_auth_dependency,
) -> FastAPI:
    """App with auth override and one category pre-seeded."""
    override_auth_dependency(mock_provider)

    # Seed one category directly (migrations don't run in test setup)
    category = CategoryModel(
        id="cat-academic",
        name="Academic",
        description="Academic events",
    )
    db_session.add(category)
    db_session.commit()

    return app


@pytest.fixture
def org_client(seeded_app: FastAPI) -> Generator[TestClient, None, None]:
    with TestClient(seeded_app) as c:
        yield c


# ---------------------------------------------------------------------------
# Payload helper
# ---------------------------------------------------------------------------

def _create_payload(
    title: str = "Test Event",
    category_ids: list[str] | None = None,
) -> dict:
    return {
        "title": title,
        "description": "A test event description",
        "date_time": _future_dt(),
        "location": "Room 101",
        "capacity": 50,
        "category_ids": category_ids or ["cat-academic"],
    }


# ---------------------------------------------------------------------------
# Role enforcement tests
# ---------------------------------------------------------------------------

class TestRoleEnforcement:
    def test_list_events_requires_auth(self, org_client: TestClient) -> None:
        response = org_client.get("/organizer/events")
        assert response.status_code == 401

    def test_list_events_forbidden_for_student(self, org_client: TestClient) -> None:
        response = org_client.get("/organizer/events", headers=_auth("student-token"))
        assert response.status_code == 403

    def test_create_event_forbidden_for_student(self, org_client: TestClient) -> None:
        response = org_client.post(
            "/organizer/events",
            headers=_auth("student-token"),
            json=_create_payload(),
        )
        assert response.status_code == 403

    def test_get_event_requires_auth(self, org_client: TestClient) -> None:
        response = org_client.get("/organizer/events/nonexistent-id")
        assert response.status_code == 401

    def test_patch_event_forbidden_for_student(self, org_client: TestClient) -> None:
        response = org_client.patch(
            "/organizer/events/nonexistent-id",
            headers=_auth("student-token"),
            json={"title": "Updated"},
        )
        assert response.status_code == 403

    def test_delete_event_forbidden_for_student(self, org_client: TestClient) -> None:
        response = org_client.delete(
            "/organizer/events/nonexistent-id",
            headers=_auth("student-token"),
        )
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Create event tests (EVNT-01 / POST)
# ---------------------------------------------------------------------------

class TestCreateEvent:
    def test_organizer_can_create_draft_event(self, org_client: TestClient) -> None:
        response = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload("My Campus Talk"),
        )
        assert response.status_code == 201
        body = response.json()
        assert body["title"] == "My Campus Talk"
        assert body["status"] == "draft"
        assert "id" in body
        assert "organizer_id" in body

    def test_create_event_sets_organizer_id_server_side(
        self, org_client: TestClient
    ) -> None:
        response = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload(),
        )
        assert response.status_code == 201
        body = response.json()
        # organizer_id must be set (server-side from authenticated user)
        assert body["organizer_id"] is not None
        assert len(body["organizer_id"]) > 0

    def test_create_event_rejects_missing_title(self, org_client: TestClient) -> None:
        payload = _create_payload()
        del payload["title"]
        response = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=payload,
        )
        assert response.status_code == 422

    def test_create_event_rejects_zero_capacity(self, org_client: TestClient) -> None:
        payload = _create_payload()
        payload["capacity"] = 0
        response = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=payload,
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# List events tests (EVNT-02 / GET list)
# ---------------------------------------------------------------------------

class TestListEvents:
    def test_organizer_sees_only_their_events(self, org_client: TestClient) -> None:
        # Create event as first organizer
        org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload("Org1 Event"),
        )
        # Create event as second organizer
        org_client.post(
            "/organizer/events",
            headers=_auth("other-organizer-token"),
            json=_create_payload("Org2 Event"),
        )

        # First organizer should see only their event
        response = org_client.get(
            "/organizer/events", headers=_auth("organizer-token")
        )
        assert response.status_code == 200
        events = response.json()
        assert len(events) == 1
        assert events[0]["title"] == "Org1 Event"

    def test_list_returns_empty_for_new_organizer(self, org_client: TestClient) -> None:
        response = org_client.get(
            "/organizer/events", headers=_auth("other-organizer-token")
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_list_supports_status_filter(self, org_client: TestClient) -> None:
        org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload("Draft Event"),
        )

        draft_response = org_client.get(
            "/organizer/events?status_filter=draft",
            headers=_auth("organizer-token"),
        )
        assert draft_response.status_code == 200
        assert len(draft_response.json()) == 1

        pending_response = org_client.get(
            "/organizer/events?status_filter=pending",
            headers=_auth("organizer-token"),
        )
        assert pending_response.status_code == 200
        assert len(pending_response.json()) == 0


# ---------------------------------------------------------------------------
# Get event tests (EVNT-03 / GET single)
# ---------------------------------------------------------------------------

class TestGetEvent:
    def test_organizer_can_view_own_event(self, org_client: TestClient) -> None:
        created = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload("Viewable Event"),
        ).json()
        event_id = created["id"]

        response = org_client.get(
            f"/organizer/events/{event_id}",
            headers=_auth("organizer-token"),
        )
        assert response.status_code == 200
        body = response.json()
        assert body["id"] == event_id
        assert body["title"] == "Viewable Event"

    def test_get_event_returns_404_for_nonexistent(
        self, org_client: TestClient
    ) -> None:
        response = org_client.get(
            "/organizer/events/nonexistent-id",
            headers=_auth("organizer-token"),
        )
        assert response.status_code == 404

    def test_get_event_returns_403_for_other_organizer(
        self, org_client: TestClient
    ) -> None:
        created = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload("Private Event"),
        ).json()
        event_id = created["id"]

        response = org_client.get(
            f"/organizer/events/{event_id}",
            headers=_auth("other-organizer-token"),
        )
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Update event tests (EVNT-04 / PATCH)
# ---------------------------------------------------------------------------

class TestUpdateEvent:
    def test_organizer_can_edit_draft_event(self, org_client: TestClient) -> None:
        created = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload("Original Title"),
        ).json()
        event_id = created["id"]

        response = org_client.patch(
            f"/organizer/events/{event_id}",
            headers=_auth("organizer-token"),
            json={"title": "Updated Title"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"

    def test_edit_rejected_event_resets_to_draft(
        self,
        org_client: TestClient,
        db_session: Session,
    ) -> None:
        """Editing a rejected event is allowed (rejected = editable)."""
        created = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload("Rejected Event"),
        ).json()
        event_id = created["id"]

        event = db_session.get(EventModel, event_id)
        assert event is not None
        event.status = "rejected"
        event.rejection_reason = "Needs revision"
        db_session.commit()

        # Now edit the rejected event
        response = org_client.patch(
            f"/organizer/events/{event_id}",
            headers=_auth("organizer-token"),
            json={"title": "Fixed Title"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Fixed Title"

    def test_patch_rejects_status_field(self, org_client: TestClient) -> None:
        created = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload("Protected Workflow Event"),
        ).json()

        response = org_client.patch(
            f"/organizer/events/{created['id']}",
            headers=_auth("organizer-token"),
            json={"status": "approved"},
        )

        assert response.status_code == 422

        list_response = org_client.get(
            "/organizer/events?status_filter=approved",
            headers=_auth("organizer-token"),
        )
        assert list_response.status_code == 200
        assert list_response.json() == []

    def test_edit_returns_400_for_nonexistent_event(
        self, org_client: TestClient
    ) -> None:
        response = org_client.patch(
            "/organizer/events/nonexistent-id",
            headers=_auth("organizer-token"),
            json={"title": "New Title"},
        )
        assert response.status_code == 400

    def test_other_organizer_cannot_edit_event(self, org_client: TestClient) -> None:
        created = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload("Protected Event"),
        ).json()
        event_id = created["id"]

        response = org_client.patch(
            f"/organizer/events/{event_id}",
            headers=_auth("other-organizer-token"),
            json={"title": "Stolen Title"},
        )
        assert response.status_code == 403

    def test_multipart_create_accepts_ordered_image_uploads(
        self,
        org_client: TestClient,
    ) -> None:
        response = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            files=[
                *_multipart_form_parts(
                    image_manifest=[
                        {"position": 0, "source": "upload", "client_id": "cover"},
                        {"position": 1, "source": "upload", "client_id": "gallery"},
                    ],
                    image_client_ids=["cover", "gallery"],
                ),
                _upload_file("image_files", "cover.png", _image_bytes("PNG"), "image/png"),
                _upload_file("image_files", "gallery.jpg", _image_bytes("JPEG"), "image/jpeg"),
            ],
        )

        assert response.status_code == 201
        body = response.json()
        assert body["images"][0]["position"] == 0
        assert body["images"][1]["position"] == 1
        assert body["images"][0]["thumbnail_url"].startswith("/media/events/")

    def test_multipart_update_can_retain_upload_and_delete_images(
        self,
        org_client: TestClient,
    ) -> None:
        created = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            files=[
                *_multipart_form_parts(
                    image_manifest=[
                        {"position": 0, "source": "upload", "client_id": "first"},
                        {"position": 1, "source": "upload", "client_id": "second"},
                    ],
                    image_client_ids=["first", "second"],
                ),
                _upload_file("image_files", "first.png", _image_bytes("PNG"), "image/png"),
                _upload_file("image_files", "second.jpg", _image_bytes("JPEG"), "image/jpeg"),
            ],
        )
        assert created.status_code == 201
        initial_images = created.json()["images"]

        update = org_client.patch(
            f"/organizer/events/{created.json()['id']}",
            headers=_auth("organizer-token"),
            files=[
                (
                    "image_manifest_json",
                    (
                        None,
                        json.dumps(
                            [
                                {
                                    "position": 0,
                                    "source": "existing",
                                    "id": initial_images[1]["id"],
                                },
                                {
                                    "position": 1,
                                    "source": "upload",
                                    "client_id": "fresh",
                                },
                            ]
                        ),
                    ),
                ),
                ("image_file_client_ids", (None, "fresh")),
                _upload_file("image_files", "fresh.webp", _image_bytes("WEBP"), "image/webp"),
            ],
        )

        assert update.status_code == 200
        body = update.json()
        assert [image["position"] for image in body["images"]] == [0, 1]
        assert body["images"][0]["id"] == initial_images[1]["id"]
        assert initial_images[0]["id"] not in [image["id"] for image in body["images"]]

    def test_multipart_upload_rejects_invalid_mime_type(
        self,
        org_client: TestClient,
    ) -> None:
        response = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            files=[
                *_multipart_form_parts(
                    image_manifest=[{"position": 0, "source": "upload", "client_id": "bad"}],
                    image_client_ids=["bad"],
                ),
                _upload_file("image_files", "notes.txt", b"not-an-image", "text/plain"),
            ],
        )

        assert response.status_code == 400
        assert "Unsupported event image type" in response.json()["detail"]

    def test_multipart_upload_rejects_oversize_file(
        self,
        org_client: TestClient,
    ) -> None:
        response = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            files=[
                *_multipart_form_parts(
                    image_manifest=[{"position": 0, "source": "upload", "client_id": "large"}],
                    image_client_ids=["large"],
                ),
                _upload_file(
                    "image_files",
                    "large.jpg",
                    b"x" * (8_388_608 + 1),
                    "image/jpeg",
                ),
            ],
        )

        assert response.status_code == 400
        assert "8 MB upload limit" in response.json()["detail"]

    def test_approved_image_only_edit_stays_approved(
        self,
        org_client: TestClient,
        db_session: Session,
    ) -> None:
        created = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload("Approved With Gallery"),
        )
        event_id = created.json()["id"]
        event = db_session.get(EventModel, event_id)
        assert event is not None
        event.status = "approved"
        db_session.commit()

        response = org_client.patch(
            f"/organizer/events/{event_id}",
            headers=_auth("organizer-token"),
            files=[
                (
                    "image_manifest_json",
                    (
                        None,
                        json.dumps([{"position": 0, "source": "upload", "client_id": "cover"}]),
                    ),
                ),
                ("image_file_client_ids", (None, "cover")),
                _upload_file("image_files", "cover.png", _image_bytes("PNG"), "image/png"),
            ],
        )

        assert response.status_code == 200
        assert response.json()["status"] == "approved"
        assert len(response.json()["images"]) == 1

    def test_unauthenticated_multipart_create_and_update_return_401(
        self,
        org_client: TestClient,
    ) -> None:
        create_response = org_client.post(
            "/organizer/events",
            files=[
                *_multipart_form_parts(
                    image_manifest=[{"position": 0, "source": "upload", "client_id": "cover"}],
                    image_client_ids=["cover"],
                ),
                _upload_file("image_files", "cover.png", _image_bytes("PNG"), "image/png"),
            ],
        )
        assert create_response.status_code == 401

        created = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload("Patch Target"),
        )
        event_id = created.json()["id"]
        update_response = org_client.patch(
            f"/organizer/events/{event_id}",
            files=[
                (
                    "image_manifest_json",
                    (
                        None,
                        json.dumps([{"position": 0, "source": "upload", "client_id": "cover"}]),
                    ),
                ),
                ("image_file_client_ids", (None, "cover")),
                _upload_file("image_files", "cover.png", _image_bytes("PNG"), "image/png"),
            ],
        )
        assert update_response.status_code == 401

    def test_imageless_events_return_empty_images_array(
        self,
        org_client: TestClient,
    ) -> None:
        response = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload("Imageless Event"),
        )

        assert response.status_code == 201
        assert response.json()["images"] == []


# ---------------------------------------------------------------------------
# Delete event tests
# ---------------------------------------------------------------------------

class TestDeleteEvent:
    def test_organizer_can_delete_draft_event(self, org_client: TestClient) -> None:
        created = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload("To Delete"),
        ).json()
        event_id = created["id"]

        response = org_client.delete(
            f"/organizer/events/{event_id}",
            headers=_auth("organizer-token"),
        )
        assert response.status_code == 204

        # Verify it's gone
        get_response = org_client.get(
            f"/organizer/events/{event_id}",
            headers=_auth("organizer-token"),
        )
        assert get_response.status_code == 404

    def test_cannot_delete_nonexistent_event(self, org_client: TestClient) -> None:
        response = org_client.delete(
            "/organizer/events/nonexistent-id",
            headers=_auth("organizer-token"),
        )
        assert response.status_code == 400

    def test_other_organizer_cannot_delete_event(self, org_client: TestClient) -> None:
        created = org_client.post(
            "/organizer/events",
            headers=_auth("organizer-token"),
            json=_create_payload("Protected Delete"),
        ).json()
        event_id = created["id"]

        response = org_client.delete(
            f"/organizer/events/{event_id}",
            headers=_auth("other-organizer-token"),
        )
        assert response.status_code == 400
