from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from fastapi import FastAPI, UploadFile
from starlette.datastructures import Headers

from app.adapters.auth.interfaces import VerifiedIdentity
from app.adapters.auth.mock import MockAuthProvider
from app.adapters.media.processing import ProcessedEventImage, validate_and_process_event_image
from app.adapters.media.storage import LocalEventImageStorage
from app.adapters.http.schemas.events import OrganizerImageManifestItem
from app.adapters.persistence.models import EventImageModel, EventModel
from app.adapters.persistence.repositories import EventRepository
from app.adapters.persistence.repositories import UserRepository
from app.bootstrap.app import create_app, get_auth_provider
from app.bootstrap.config import Settings
from app.bootstrap.db import Base, get_session
from app.application.organizer.image_service import OrganizerEventImageService
from app.application.organizer.services import OrganizerEventService
from app.domain.users.entities import UserRole


def _make_upload(filename: str, content_type: str, payload: bytes) -> UploadFile:
    return UploadFile(
        file=BytesIO(payload),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


def _make_image_bytes(image_format: str) -> bytes:
    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", (1200, 800), color=(40, 110, 180)).save(buffer, format=image_format)
    return buffer.getvalue()


def _make_processed_fixture(original_extension: str = "jpg") -> ProcessedEventImage:
    return ProcessedEventImage(
        original_filename=f"fixture.{original_extension}",
        original_extension=original_extension,
        content_type=f"image/{'jpeg' if original_extension == 'jpg' else original_extension}",
        file_size_bytes=12,
        width=1200,
        height=800,
        original_bytes=b"original",
        display_bytes=b"display",
        thumbnail_bytes=b"thumbnail",
    )


def _seed_media_app(
    *,
    tmp_path: Path,
    auth_provider: MockAuthProvider,
) -> tuple[FastAPI, str]:
    database_url = f"sqlite:///{(tmp_path / 'media-tests.db').as_posix()}"
    settings = Settings(
        database_url=database_url,
        auth_provider="mock",
        media_root=tmp_path / "media-root",
    )
    app = create_app(settings=settings)
    Base.metadata.create_all(bind=app.state.engine)
    app.dependency_overrides[get_auth_provider] = lambda: auth_provider

    def _override_session():
        session = app.state.session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = _override_session

    session = app.state.session_factory()
    organizer = UserRepository(session).create_user(
        email="organizer@humber.ca",
        display_name="Dev Organizer",
        role=UserRole.ORGANIZER,
    )
    UserRepository(session).create_user(
        email="student@humber.ca",
        display_name="Dev Student",
        role=UserRole.STUDENT,
    )
    UserRepository(session).create_user(
        email="other@humber.ca",
        display_name="Other Organizer",
        role=UserRole.ORGANIZER,
    )

    approved_event = EventModel(
        id="evt-approved",
        title="Approved Event",
        description="Approved event description",
        date_time=datetime(2027, 6, 1, 15, 0, tzinfo=timezone.utc),
        location="North Campus",
        capacity=50,
        organizer_id=str(organizer.id),
        status="approved",
    )
    draft_event = EventModel(
        id="evt-draft",
        title="Draft Event",
        description="Draft event description",
        date_time=datetime(2027, 6, 2, 15, 0, tzinfo=timezone.utc),
        location="Lakeshore Campus",
        capacity=50,
        organizer_id=str(organizer.id),
        status="draft",
    )
    session.add_all([approved_event, draft_event])
    session.commit()

    storage = LocalEventImageStorage(settings.media_root, settings.media_url_prefix)
    storage.save_event_image(
        event_id="evt-approved",
        image_id="img-1",
        processed=_make_processed_fixture("jpg"),
    )
    storage.save_event_image(
        event_id="evt-draft",
        image_id="img-1",
        processed=_make_processed_fixture("png"),
    )
    session.close()
    return app, str(settings.media_root)


def test_validate_and_process_event_image_accepts_expected_formats() -> None:
    fixtures = [
        ("poster.jpg", "image/jpeg", "JPEG", "jpg"),
        ("poster.png", "image/png", "PNG", "png"),
        ("poster.webp", "image/webp", "WEBP", "webp"),
    ]

    for filename, content_type, image_format, extension in fixtures:
        processed = asyncio.run(
            validate_and_process_event_image(
                _make_upload(filename, content_type, _make_image_bytes(image_format))
            )
        )

        assert processed.original_extension == extension
        assert processed.content_type == content_type
        assert processed.width == 1200
        assert processed.height == 800
        assert processed.display_bytes
        assert processed.thumbnail_bytes


def test_validate_and_process_event_image_rejects_unsupported_type_and_oversize() -> None:
    invalid_upload = _make_upload("poster.txt", "text/plain", b"not-an-image")
    oversized_upload = _make_upload(
        "poster.jpg",
        "image/jpeg",
        b"x" * (8_388_608 + 1),
    )

    try:
        asyncio.run(validate_and_process_event_image(invalid_upload))
    except ValueError as error:
        assert "Unsupported event image type" in str(error)
    else:
        raise AssertionError("Unsupported content type should fail.")

    try:
        asyncio.run(validate_and_process_event_image(oversized_upload))
    except ValueError as error:
        assert "8 MB upload limit" in str(error)
    else:
        raise AssertionError("Oversized upload should fail.")


def test_local_event_image_storage_writes_urls_and_deletes_paths(tmp_path: Path) -> None:
    storage = LocalEventImageStorage(tmp_path / "media", "/media")
    saved = storage.save_event_image(
        event_id="evt-1",
        image_id="img-1",
        processed=_make_processed_fixture("webp"),
    )

    assert saved.original_path.name == "original.webp"
    assert saved.display_path.name == "display.jpg"
    assert saved.thumbnail_path.name == "thumbnail.jpg"
    assert saved.original_url == "/media/events/evt-1/img-1/original.webp"
    assert saved.display_url == "/media/events/evt-1/img-1/display.jpg"
    assert saved.thumbnail_url == "/media/events/evt-1/img-1/thumbnail.jpg"

    storage.delete_image_directory("evt-1", "img-1")
    assert not saved.image_dir.exists()

    storage.save_event_image(
        event_id="evt-1",
        image_id="img-2",
        processed=_make_processed_fixture("jpg"),
    )
    storage.delete_event_directory("evt-1")
    assert not (tmp_path / "media" / "events" / "evt-1").exists()


def test_media_settings_defaults_and_authenticated_media_route(tmp_path: Path) -> None:
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'settings.db').as_posix()}",
        auth_provider="mock",
        media_root=tmp_path / "configured-media",
    )
    app = create_app(settings=settings)

    try:
        assert settings.media_url_prefix == "/media"
        assert settings.max_event_image_bytes == 8_388_608
        assert settings.max_event_images_per_event == 10
        assert settings.media_root.exists()
        assert any(
            route.path == "/media/events/{event_id}/{image_id}/{filename}"
            for route in app.routes
        )
    finally:
        app.state.engine.dispose()
        Base.metadata.drop_all(bind=app.state.engine)


def test_authenticated_media_route_enforces_visibility_rules(tmp_path: Path) -> None:
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
        "other-organizer-token",
        VerifiedIdentity(
            provider="mock",
            external_uid="mock-organizer-002",
            email="other@humber.ca",
            display_name="Other Organizer",
            role="organizer",
        ),
    )
    app, _ = _seed_media_app(tmp_path=tmp_path, auth_provider=provider)

    try:
        with TestClient(app) as client:
            approved_response = client.get(
                "/media/events/evt-approved/img-1/display.jpg",
                headers={"Authorization": "Bearer student-token"},
            )
            assert approved_response.status_code == 200
            assert approved_response.headers["content-type"].startswith("image/jpeg")

            organizer_response = client.get(
                "/media/events/evt-draft/img-1/original.png",
                headers={"Authorization": "Bearer organizer-token"},
            )
            assert organizer_response.status_code == 200

            unauthenticated_response = client.get("/media/events/evt-approved/img-1/display.jpg")
            assert unauthenticated_response.status_code == 401

            forbidden_response = client.get(
                "/media/events/evt-draft/img-1/original.png",
                headers={"Authorization": "Bearer other-organizer-token"},
            )
            assert forbidden_response.status_code == 403
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=app.state.engine)
        app.state.engine.dispose()


def test_sync_event_images_reorders_retained_images_and_cleans_removed_files(
    tmp_path: Path,
    db_session,
) -> None:
    storage = LocalEventImageStorage(tmp_path / "media", "/media")
    event = EventModel(
        id="evt-reorder",
        title="Reorder Event",
        description="Reorder event description",
        date_time=datetime(2027, 6, 1, 10, 0, tzinfo=timezone.utc),
        location="North Campus",
        capacity=50,
        organizer_id="1",
        status="draft",
    )
    first = storage.save_event_image(
        event_id=event.id,
        image_id="img-first",
        processed=_make_processed_fixture("png"),
    )
    second = storage.save_event_image(
        event_id=event.id,
        image_id="img-second",
        processed=_make_processed_fixture("jpg"),
    )
    event.images = [
        EventImageModel(
            id="img-first",
            event_id=event.id,
            sort_order=0,
            original_filename="first.png",
            content_type="image/png",
            file_size_bytes=10,
            width=800,
            height=600,
            original_url=first.original_url,
            display_url=first.display_url,
            thumbnail_url=first.thumbnail_url,
        ),
        EventImageModel(
            id="img-second",
            event_id=event.id,
            sort_order=1,
            original_filename="second.jpg",
            content_type="image/jpeg",
            file_size_bytes=10,
            width=800,
            height=600,
            original_url=second.original_url,
            display_url=second.display_url,
            thumbnail_url=second.thumbnail_url,
        ),
    ]
    db_session.add(event)
    db_session.commit()

    service = OrganizerEventImageService(session=db_session, storage=storage)
    cleanup = asyncio.run(
        service.sync_event_images(
            event=event,
            image_manifest=[
                OrganizerImageManifestItem(position=0, source="existing", id="img-second"),
            ],
            image_uploads={},
        )
    )
    db_session.commit()
    service.cleanup_removed_images(event.id, cleanup.removed_image_ids)

    refreshed = EventRepository(db_session).get_by_id(event.id)
    assert refreshed is not None
    assert [image.id for image in refreshed.images] == ["img-second"]
    assert refreshed.images[0].sort_order == 0
    assert "img-first" in cleanup.removed_image_ids
    assert not (tmp_path / "media" / "events" / event.id / "img-first").exists()


def test_organizer_service_persists_processed_variant_urls_for_new_upload(
    tmp_path: Path,
    db_session,
) -> None:
    storage = LocalEventImageStorage(tmp_path / "media", "/media")
    event = EventModel(
        id="evt-upload",
        title="Upload Event",
        description="Upload event description",
        date_time=datetime(2027, 6, 1, 10, 0, tzinfo=timezone.utc),
        location="North Campus",
        capacity=50,
        organizer_id="1",
        status="draft",
    )
    db_session.add(event)
    db_session.commit()

    service = OrganizerEventService(
        event_repo=EventRepository(db_session),
        image_service=OrganizerEventImageService(session=db_session, storage=storage),
    )
    updated = asyncio.run(
        service.update_event_with_images(
            event.id,
            "1",
            image_manifest=[
                OrganizerImageManifestItem(position=0, source="upload", client_id="cover"),
            ],
            image_uploads={
                "cover": _make_upload("cover.png", "image/png", _make_image_bytes("PNG")),
            },
        )
    )

    assert updated is not None
    assert len(updated.images) == 1
    assert updated.images[0].original_url.endswith("/original.png")
    assert updated.images[0].display_url.endswith("/display.jpg")
    assert (tmp_path / "media" / "events" / event.id / updated.images[0].id / "display.jpg").exists()


def test_approved_image_only_edit_remains_approved_in_application_service(
    tmp_path: Path,
    db_session,
) -> None:
    storage = LocalEventImageStorage(tmp_path / "media", "/media")
    event = EventModel(
        id="evt-approved-images",
        title="Approved Event",
        description="Approved event description",
        date_time=datetime(2027, 6, 1, 10, 0, tzinfo=timezone.utc),
        location="North Campus",
        capacity=50,
        organizer_id="1",
        status="approved",
    )
    db_session.add(event)
    db_session.commit()

    service = OrganizerEventService(
        event_repo=EventRepository(db_session),
        image_service=OrganizerEventImageService(session=db_session, storage=storage),
    )
    updated = asyncio.run(
        service.update_event_with_images(
            event.id,
            "1",
            image_manifest=[
                OrganizerImageManifestItem(position=0, source="upload", client_id="cover"),
            ],
            image_uploads={
                "cover": _make_upload("cover.webp", "image/webp", _make_image_bytes("WEBP")),
            },
        )
    )

    assert updated is not None
    assert updated.status == "approved"
    assert updated.images[0].sort_order == 0
