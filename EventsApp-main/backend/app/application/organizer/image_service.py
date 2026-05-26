from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.adapters.http.schemas.events import OrganizerImageManifestItem
from app.adapters.media.processing import validate_and_process_event_image
from app.adapters.media.storage import LocalEventImageStorage
from app.adapters.persistence.models import EventImageModel, EventModel


@dataclass(frozen=True, slots=True)
class ImageSyncCleanup:
    created_image_ids: list[str]
    removed_image_ids: list[str]


class OrganizerEventImageService:
    def __init__(
        self,
        *,
        session: Session,
        storage: LocalEventImageStorage,
        max_images_per_event: int = 10,
        max_event_image_bytes: int = 8_388_608,
    ) -> None:
        self._session = session
        self._storage = storage
        self._max_images_per_event = max_images_per_event
        self._max_event_image_bytes = max_event_image_bytes

    def _ordered_manifest(
        self,
        image_manifest: list[OrganizerImageManifestItem],
    ) -> list[OrganizerImageManifestItem]:
        ordered = sorted(image_manifest, key=lambda item: item.position)
        if len(ordered) > self._max_images_per_event:
            raise ValueError(
                f"You can upload up to {self._max_images_per_event} images per event."
            )
        expected_positions = list(range(len(ordered)))
        actual_positions = [item.position for item in ordered]
        if actual_positions != expected_positions:
            raise ValueError("Image manifest positions must be contiguous and zero-based.")
        return ordered

    async def sync_event_images(
        self,
        *,
        event: EventModel,
        image_manifest: list[OrganizerImageManifestItem],
        image_uploads: dict[str, UploadFile],
    ) -> ImageSyncCleanup:
        ordered_manifest = self._ordered_manifest(image_manifest)
        existing_by_id = {image.id: image for image in event.images}
        expected_upload_ids = {
            item.client_id
            for item in ordered_manifest
            if item.source == "upload" and item.client_id is not None
        }
        unexpected_uploads = set(image_uploads) - expected_upload_ids
        if unexpected_uploads:
            raise ValueError("Image manifest is missing uploaded image references.")

        ordered_images: list[EventImageModel] = []
        retained_existing_ids: set[str] = set()
        created_image_ids: list[str] = []

        for manifest_item in ordered_manifest:
            if manifest_item.source == "existing":
                image_id = manifest_item.id or ""
                existing_image = existing_by_id.get(image_id)
                if existing_image is None:
                    raise ValueError("Image manifest referenced an unknown existing image.")
                retained_existing_ids.add(image_id)
                ordered_images.append(existing_image)
                continue

            client_id = manifest_item.client_id or ""
            upload = image_uploads.get(client_id)
            if upload is None:
                raise ValueError("Image manifest referenced an uploaded image that was missing.")

            processed = await validate_and_process_event_image(
                upload,
                max_bytes=self._max_event_image_bytes,
            )
            image_id = str(uuid4())
            stored = self._storage.save_event_image(
                event_id=event.id,
                image_id=image_id,
                processed=processed,
            )
            image_model = EventImageModel(
                id=image_id,
                event_id=event.id,
                sort_order=manifest_item.position,
                original_filename=processed.original_filename,
                content_type=processed.content_type,
                file_size_bytes=processed.file_size_bytes,
                width=processed.width,
                height=processed.height,
                original_url=stored.original_url,
                display_url=stored.display_url,
                thumbnail_url=stored.thumbnail_url,
            )
            self._session.add(image_model)
            ordered_images.append(image_model)
            created_image_ids.append(image_id)

        removed_image_ids = [
            image.id for image in event.images if image.id not in retained_existing_ids
        ]
        for image in list(event.images):
            if image.id in removed_image_ids:
                self._session.delete(image)

        for sort_order, image in enumerate(ordered_images):
            image.sort_order = sort_order

        event.images = ordered_images
        self._session.flush()
        return ImageSyncCleanup(
            created_image_ids=created_image_ids,
            removed_image_ids=removed_image_ids,
        )

    def cleanup_removed_images(self, event_id: str, removed_image_ids: list[str]) -> None:
        for image_id in removed_image_ids:
            self._storage.delete_image_directory(event_id, image_id)

    def cleanup_created_images(self, event_id: str, created_image_ids: list[str]) -> None:
        for image_id in created_image_ids:
            self._storage.delete_image_directory(event_id, image_id)
