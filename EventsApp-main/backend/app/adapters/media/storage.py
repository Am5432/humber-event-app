from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import shutil

from app.adapters.media.processing import ProcessedEventImage


@dataclass(frozen=True, slots=True)
class StoredEventImagePaths:
    image_dir: Path
    original_path: Path
    display_path: Path
    thumbnail_path: Path
    original_url: str
    display_url: str
    thumbnail_url: str


class LocalEventImageStorage:
    def __init__(self, root: Path, url_prefix: str = "/media") -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        cleaned_prefix = url_prefix.strip()
        if not cleaned_prefix.startswith("/"):
            cleaned_prefix = f"/{cleaned_prefix}"
        self.url_prefix = cleaned_prefix.rstrip("/")

    def _resolve_within_root(self, *parts: str) -> Path:
        candidate = (self.root / Path(*parts)).resolve()
        root = self.root.resolve()
        try:
            candidate.relative_to(root)
        except ValueError as error:
            raise ValueError("Resolved media path escaped the configured media root.") from error
        return candidate

    def build_event_image_url(self, event_id: str, image_id: str, filename: str) -> str:
        return f"{self.url_prefix}/events/{event_id}/{image_id}/{filename}"

    def resolve_event_image_path(self, event_id: str, image_id: str, filename: str) -> Path:
        return self._resolve_within_root("events", event_id, image_id, filename)

    def save_event_image(
        self,
        *,
        event_id: str,
        image_id: str,
        processed: ProcessedEventImage,
    ) -> StoredEventImagePaths:
        image_dir = self._resolve_within_root("events", event_id, image_id)
        image_dir.mkdir(parents=True, exist_ok=True)

        original_filename = f"original.{processed.original_extension}"
        original_path = image_dir / original_filename
        display_path = image_dir / "display.jpg"
        thumbnail_path = image_dir / "thumbnail.jpg"

        original_path.write_bytes(processed.original_bytes)
        display_path.write_bytes(processed.display_bytes)
        thumbnail_path.write_bytes(processed.thumbnail_bytes)

        return StoredEventImagePaths(
            image_dir=image_dir,
            original_path=original_path,
            display_path=display_path,
            thumbnail_path=thumbnail_path,
            original_url=self.build_event_image_url(event_id, image_id, original_filename),
            display_url=self.build_event_image_url(event_id, image_id, "display.jpg"),
            thumbnail_url=self.build_event_image_url(event_id, image_id, "thumbnail.jpg"),
        )

    def delete_image_directory(self, event_id: str, image_id: str) -> None:
        image_dir = self._resolve_within_root("events", event_id, image_id)
        shutil.rmtree(image_dir, ignore_errors=True)

    def delete_event_directory(self, event_id: str) -> None:
        event_dir = self._resolve_within_root("events", event_id)
        shutil.rmtree(event_dir, ignore_errors=True)
