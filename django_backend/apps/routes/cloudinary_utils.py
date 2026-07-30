"""Cloudinary photo upload helper."""

import cloudinary
import cloudinary.uploader
from django.conf import settings


def _configure() -> None:
    """Configure Cloudinary from Django settings."""
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def upload_photo(file_bytes: bytes, filename: str) -> tuple[str, str]:
    """Upload photo bytes and return its secure URL and public ID.

    Args:
        file_bytes: Raw image bytes.
        filename: Original filename (used as public_id base).

    Returns:
        A tuple containing the Cloudinary secure URL and public ID.

    Raises:
        RuntimeError: If Cloudinary credentials are not configured or upload fails.
    """
    if not all(
        [
            settings.CLOUDINARY_CLOUD_NAME,
            settings.CLOUDINARY_API_KEY,
            settings.CLOUDINARY_API_SECRET,
        ]
    ):
        raise RuntimeError("Cloudinary credentials are not configured.")

    _configure()

    import io

    result = cloudinary.uploader.upload(
        io.BytesIO(file_bytes),
        folder="map-routes/photos",
        resource_type="image",
    )
    return result["secure_url"], result["public_id"]


def delete_photo(public_id: str) -> None:
    """Delete a Cloudinary image, treating an already-missing asset as success."""
    if not all(
        [
            settings.CLOUDINARY_CLOUD_NAME,
            settings.CLOUDINARY_API_KEY,
            settings.CLOUDINARY_API_SECRET,
        ]
    ):
        raise RuntimeError("Cloudinary credentials are not configured.")

    _configure()
    result = cloudinary.uploader.destroy(public_id, resource_type="image", invalidate=True)
    if result.get("result") not in ("ok", "not found"):
        raise RuntimeError("Photo deletion from Cloudinary failed.")
