from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError


ALLOWED_EVENT_IMAGE_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


@dataclass(frozen=True, slots=True)
class ProcessedEventImage:
    original_filename: str
    original_extension: str
    content_type: str
    file_size_bytes: int
    width: int
    height: int
    original_bytes: bytes
    display_bytes: bytes
    thumbnail_bytes: bytes


def _render_variant(image: Image.Image, *, max_size: tuple[int, int], quality: int) -> bytes:
    variant = image.copy()
    variant.thumbnail(max_size)
    buffer = BytesIO()
    variant.save(buffer, "JPEG", quality=quality, optimize=True, progressive=True)
    return buffer.getvalue()


async def validate_and_process_event_image(
    upload: UploadFile,
    *,
    max_bytes: int = 8_388_608,
) -> ProcessedEventImage:
    content_type = (upload.content_type or "").lower()
    original_extension = ALLOWED_EVENT_IMAGE_CONTENT_TYPES.get(content_type)
    if original_extension is None:
        raise ValueError("Unsupported event image type.")

    original_bytes = await upload.read()
    file_size_bytes = len(original_bytes)
    if file_size_bytes == 0:
        raise ValueError("Event images cannot be empty.")
    if file_size_bytes > max_bytes:
        raise ValueError("Event image exceeds the 8 MB upload limit.")

    try:
        with Image.open(BytesIO(original_bytes)) as opened_image:
            normalized = ImageOps.exif_transpose(opened_image).convert("RGB")
            width, height = normalized.size
            display_bytes = _render_variant(
                normalized,
                max_size=(1600, 1600),
                quality=85,
            )
            thumbnail_bytes = _render_variant(
                normalized,
                max_size=(480, 480),
                quality=75,
            )
    except (UnidentifiedImageError, OSError) as error:
        raise ValueError("Uploaded file is not a valid image.") from error

    return ProcessedEventImage(
        original_filename=upload.filename or f"upload.{original_extension}",
        original_extension=original_extension,
        content_type=content_type,
        file_size_bytes=file_size_bytes,
        width=width,
        height=height,
        original_bytes=original_bytes,
        display_bytes=display_bytes,
        thumbnail_bytes=thumbnail_bytes,
    )
