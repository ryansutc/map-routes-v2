"""Tests for Cloudinary photo storage operations."""

from unittest.mock import patch

from django.test import override_settings

from apps.routes.cloudinary_utils import upload_photo


@override_settings(
    CLOUDINARY_CLOUD_NAME="test-cloud",
    CLOUDINARY_API_KEY="test-key",
    CLOUDINARY_API_SECRET="test-secret",
    CLOUDINARY_FOLDER_NAME="",
)
@patch("apps.routes.cloudinary_utils.cloudinary.uploader.upload")
def test_upload_photo_uses_base_folder_when_subfolder_is_unset(upload_mock):
    """Preserve the existing upload destination by default."""
    upload_mock.return_value = {
        "secure_url": "https://res.cloudinary.com/photo.jpg",
        "public_id": "map-routes/photos/photo-id",
    }

    upload_photo(b"image", "photo.jpg")

    assert upload_mock.call_args.kwargs["folder"] == "map-routes/photos"


@override_settings(
    CLOUDINARY_CLOUD_NAME="test-cloud",
    CLOUDINARY_API_KEY="test-key",
    CLOUDINARY_API_SECRET="test-secret",
    CLOUDINARY_FOLDER_NAME="production",
)
@patch("apps.routes.cloudinary_utils.cloudinary.uploader.upload")
def test_upload_photo_appends_configured_subfolder(upload_mock):
    """Isolate production photos beneath the shared photo folder."""
    upload_mock.return_value = {
        "secure_url": "https://res.cloudinary.com/photo.jpg",
        "public_id": "map-routes/photos/production/photo-id",
    }

    secure_url, public_id = upload_photo(b"image", "photo.jpg")

    assert secure_url == "https://res.cloudinary.com/photo.jpg"
    assert public_id == "map-routes/photos/production/photo-id"
    assert upload_mock.call_args.kwargs["folder"] == "map-routes/photos/production"
