from datetime import datetime, timezone

from app.adapters.persistence.models import CategoryModel, EventModel
from app.adapters.persistence.repositories import UserRepository
from app.domain.users.entities import UserRole


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_users_me_requires_bearer_token(client) -> None:
    response = client.get("/users/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "Bearer token required."


def test_users_me_returns_current_profile_for_valid_mock_token(client) -> None:
    response = client.get("/users/me", headers=_auth_headers("dev-student-token"))

    assert response.status_code == 200
    assert response.json() == {
        "id": 1,
        "email": "student@humber.ca",
        "display_name": "Dev Student",
        "role": "student",
    }


def test_patch_users_me_updates_only_display_name(client) -> None:
    response = client.patch(
        "/users/me",
        headers=_auth_headers("dev-student-token"),
        json={"display_name": "Updated Student", "role": "admin"},
    )

    assert response.status_code == 422

    success_response = client.patch(
        "/users/me",
        headers=_auth_headers("dev-student-token"),
        json={"display_name": "Updated Student"},
    )

    assert success_response.status_code == 200
    assert success_response.json()["display_name"] == "Updated Student"
    assert success_response.json()["email"] == "student@humber.ca"
    assert success_response.json()["role"] == "student"


def test_admin_check_returns_forbidden_for_student_role(client) -> None:
    response = client.get(
        "/auth/admin-check",
        headers=_auth_headers("dev-student-token"),
    )

    assert response.status_code == 403


def test_admin_check_returns_ok_for_admin_role(client, db_session) -> None:
    response = client.get(
        "/auth/admin-check",
        headers=_auth_headers("dev-admin-token"),
    )

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "role": "admin"}

    repository = UserRepository(db_session)
    created_user = repository.get_by_email("admin@humber.ca")
    assert created_user is not None
    assert created_user.role == UserRole.ADMIN


def test_users_me_returns_organizer_profile_for_fresh_organizer(client) -> None:
    response = client.get("/users/me", headers=_auth_headers("dev-organizer-token"))

    assert response.status_code == 200
    assert response.json()["role"] == "organizer"


def test_users_public_profile_returns_summary_counts(client, db_session) -> None:
    repository = UserRepository(db_session)
    organizer = repository.create_user(
        email="public.organizer@humber.ca",
        display_name="Public Organizer",
        role=UserRole.ORGANIZER,
    )

    category = CategoryModel(id="cat-public", name="Public", description="Public events")
    db_session.add(category)
    event = EventModel(
        id="evt-public-organizer",
        title="Public Event",
        description="Visible event",
        date_time=datetime(2027, 7, 1, 18, 0, tzinfo=timezone.utc),
        location="North Campus",
        capacity=50,
        registrations_count=10,
        organizer_id=str(organizer.id),
        status="approved",
    )
    event.categories.append(category)
    db_session.add(event)
    db_session.commit()

    response = client.get(f"/users/{organizer.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] == "Public Organizer"
    assert body["role"] == "organizer"
    assert body["approved_events_count"] == 1
    assert body["organized_events_count"] == 1


def test_users_me_registrations_returns_latest_registered_events(client, db_session) -> None:
    repository = UserRepository(db_session)
    student = repository.create_user(
        email="student@humber.ca",
        display_name="Dev Student",
        role=UserRole.STUDENT,
    )
    organizer = repository.create_user(
        email="organizer.registration@humber.ca",
        display_name="Registration Organizer",
        role=UserRole.ORGANIZER,
    )

    category = CategoryModel(
        id="cat-registrations",
        name="Registrations",
        description="Registration-backed events",
    )
    db_session.add(category)
    event = EventModel(
        id="evt-registration-1",
        title="Registered Event",
        description="Saved by the student",
        date_time=datetime(2027, 8, 1, 17, 0, tzinfo=timezone.utc),
        location="Lakeshore",
        capacity=60,
        registrations_count=0,
        organizer_id=str(organizer.id),
        status="approved",
    )
    event.categories.append(category)
    db_session.add(event)
    db_session.commit()

    register_response = client.post(
        "/events/evt-registration-1/register",
        headers=_auth_headers("dev-student-token"),
    )
    assert register_response.status_code == 200

    response = client.get(
        "/users/me/registrations?limit=10",
        headers=_auth_headers("dev-student-token"),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == "evt-registration-1"
    assert body[0]["is_registered"] is True
    assert body[0]["organizer"]["display_name"] == "Registration Organizer"
    assert body[0]["registered_at"] is not None
