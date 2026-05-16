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


def upload_photo(file_bytes: bytes, filename: str) -> str:
    """Upload photo bytes to Cloudinary and return the secure URL.

    Args:
        file_bytes: Raw image bytes.
        filename: Original filename (used as public_id base).

    Returns:
        The Cloudinary secure_url for the uploaded image.

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
    return result["secure_url"]
