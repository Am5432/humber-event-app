"""API tests for admin user management endpoints."""

from __future__ import annotations

from typing import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.adapters.auth.interfaces import VerifiedIdentity
from app.adapters.auth.mock import MockAuthProvider
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
    repo.create_user(
        email="organizer@humber.ca",
        display_name="Dev Organizer",
        role=UserRole.ORGANIZER,
    )
    repo.create_user(
        email="student@humber.ca",
        display_name="Dev Student",
        role=UserRole.STUDENT,
    )

    return app


@pytest.fixture
def admin_client(admin_app: FastAPI) -> Generator[TestClient, None, None]:
    with TestClient(admin_app) as client:
        yield client


def test_admin_can_list_users(admin_client: TestClient) -> None:
    response = admin_client.get("/admin/users", headers=_auth("admin-token"))

    assert response.status_code == 200
    body = response.json()
    assert {user["email"] for user in body} == {
        "admin@humber.ca",
        "organizer@humber.ca",
        "student@humber.ca",
    }
    assert body[0]["created_at"]


def test_admin_can_filter_users_by_query_and_role(admin_client: TestClient) -> None:
    response = admin_client.get(
        "/admin/users",
        params={"q": "organizer", "role": "organizer"},
        headers=_auth("admin-token"),
    )

    assert response.status_code == 200
    assert [user["email"] for user in response.json()] == ["organizer@humber.ca"]


def test_admin_can_update_user_role(admin_client: TestClient) -> None:
    users_response = admin_client.get("/admin/users", headers=_auth("admin-token"))
    student_id = next(
        user["id"]
        for user in users_response.json()
        if user["email"] == "student@humber.ca"
    )

    response = admin_client.patch(
        f"/admin/users/{student_id}/role",
        headers=_auth("admin-token"),
        json={"role": "organizer"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "student@humber.ca"
    assert body["role"] == "organizer"


def test_admin_cannot_remove_own_admin_role(admin_client: TestClient) -> None:
    users_response = admin_client.get("/admin/users", headers=_auth("admin-token"))
    admin_id = next(
        user["id"]
        for user in users_response.json()
        if user["email"] == "admin@humber.ca"
    )

    response = admin_client.patch(
        f"/admin/users/{admin_id}/role",
        headers=_auth("admin-token"),
        json={"role": "student"},
    )

    assert response.status_code == 409
    assert "own admin role" in response.json()["detail"]


def test_non_admin_cannot_access_user_management(admin_client: TestClient) -> None:
    list_response = admin_client.get("/admin/users", headers=_auth("student-token"))
    update_response = admin_client.patch(
        "/admin/users/1/role",
        headers=_auth("student-token"),
        json={"role": "admin"},
    )

    assert list_response.status_code == 403
    assert update_response.status_code == 403
