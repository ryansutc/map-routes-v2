"""API tests for owner-managed route and photo editing."""

# ruff: noqa: D102

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.routes.models import Photo, Route


class EditingApiTests(TestCase):
    """Exercise route and nested photo editing boundaries."""

    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            username="owner@example.com", email="owner@example.com", password="test"
        )
        self.other_user = get_user_model().objects.create_user(
            username="other@example.com", email="other@example.com", password="test"
        )
        self.route = Route.objects.create(
            title="Original",
            activity_date=timezone.now(),
            activity_type="Hiking",
            distance=12.5,
            duration=3600,
            avg_pace=5.2,
            elevation_gain=400,
            arcgis_item_id="immutable-item",
            geojson={"type": "FeatureCollection", "features": []},
            notes="Original notes",
            owner=self.owner.email,
            is_public=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def test_owner_can_patch_only_route_information(self):
        old_updated_at = self.route.updated_at
        response = self.client.patch(
            f"/api/route/{self.route.pk}/",
            {
                "title": "  Updated title  ",
                "activity_type": "Running",
                "notes": "  Updated notes  ",
                "is_public": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.route.refresh_from_db()
        self.assertEqual(self.route.title, "Updated title")
        self.assertEqual(self.route.activity_type, "Running")
        self.assertEqual(self.route.notes, "Updated notes")
        self.assertFalse(self.route.is_public)
        self.assertGreater(self.route.updated_at, old_updated_at)
        self.assertIn("updated_at", response.data)

    def test_route_patch_rejects_immutable_and_unknown_fields(self):
        immutable_values = {
            "activity_date": "2024-01-01T00:00:00Z",
            "distance": 1,
            "duration": 1,
            "avg_pace": 1,
            "elevation_gain": 1,
            "track_point_count": 1,
            "geojson": {},
            "arcgis_item_id": "changed",
            "owner": "other@example.com",
            "unexpected": "value",
        }
        for field, value in immutable_values.items():
            with self.subTest(field=field):
                response = self.client.patch(
                    f"/api/route/{self.route.pk}/", {field: value}, format="json"
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.data)

    def test_put_is_disabled(self):
        response = self.client.put(
            f"/api/route/{self.route.pk}/", {"title": "Changed"}, format="json"
        )
        self.assertEqual(response.status_code, 405)

    def test_non_owner_cannot_patch_route(self):
        self.client.force_authenticate(self.other_user)
        response = self.client.patch(
            f"/api/route/{self.route.pk}/", {"title": "Changed"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_no_op_patch_preserves_updated_at(self):
        old_updated_at = self.route.updated_at
        response = self.client.patch(
            f"/api/route/{self.route.pk}/",
            {
                "title": self.route.title,
                "activity_type": self.route.activity_type,
                "notes": self.route.notes,
                "is_public": self.route.is_public,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.route.refresh_from_db()
        self.assertEqual(self.route.updated_at, old_updated_at)

    def test_photo_title_change_does_not_update_route(self):
        photo = Photo.objects.create(
            route=self.route, url="https://example.com/photo.jpg", title="Old"
        )
        old_updated_at = self.route.updated_at
        response = self.client.patch(
            f"/api/route/{self.route.pk}/photos/{photo.pk}/",
            {"title": "  New  "},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        photo.refresh_from_db()
        self.route.refresh_from_db()
        self.assertEqual(photo.title, "New")
        self.assertEqual(self.route.updated_at, old_updated_at)

    def test_photo_patch_rejects_other_fields_and_wrong_route(self):
        photo = Photo.objects.create(route=self.route, url="https://example.com/photo.jpg")
        response = self.client.patch(
            f"/api/route/{self.route.pk}/photos/{photo.pk}/",
            {"latitude": 49.1},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("latitude", response.data)

        other_route = Route.objects.create(
            title="Other route",
            activity_date=timezone.now(),
            activity_type="Hiking",
            owner=self.owner.email,
        )
        response = self.client.patch(
            f"/api/route/{other_route.pk}/photos/{photo.pk}/",
            {"title": "Changed"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    @patch(
        "apps.routes.photo_views.upload_photo",
        return_value=("https://res.cloudinary.com/photo.jpg", "map-routes/photos/new"),
    )
    def test_photo_upload_persists_cloudinary_public_id(self, upload_mock):
        """A successful upload stores both values needed for later deletion."""
        image = SimpleUploadedFile("photo.jpg", b"not-real-image", content_type="image/jpeg")
        response = self.client.post(
            f"/api/route/{self.route.pk}/photos/",
            {"file": image, "title": " New photo "},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        photo = Photo.objects.get(pk=response.data["id"])
        self.assertEqual(photo.cloudinary_public_id, "map-routes/photos/new")
        upload_mock.assert_called_once()

    def test_photo_limit_counts_existing_photos(self):
        """The upload endpoint refuses a twenty-first photo."""
        Photo.objects.bulk_create(
            [
                Photo(route=self.route, url=f"https://example.com/{index}.jpg")
                for index in range(20)
            ]
        )
        response = self.client.post(f"/api/route/{self.route.pk}/photos/", {}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("maximum of 20", response.data["detail"])

    @patch("apps.routes.photo_views.delete_photo")
    def test_photo_delete_removes_cloudinary_asset_then_record(self, delete_mock):
        photo = Photo.objects.create(
            route=self.route,
            url="https://example.com/photo.jpg",
            cloudinary_public_id="map-routes/photos/abc",
        )
        response = self.client.delete(f"/api/route/{self.route.pk}/photos/{photo.pk}/")
        self.assertEqual(response.status_code, 204)
        delete_mock.assert_called_once_with("map-routes/photos/abc")
        self.assertFalse(Photo.objects.filter(pk=photo.pk).exists())

    @patch("apps.routes.photo_views.delete_photo", side_effect=RuntimeError("Cloudinary failed."))
    def test_photo_delete_failure_retains_record(self, _delete_mock):
        photo = Photo.objects.create(
            route=self.route,
            url="https://example.com/photo.jpg",
            cloudinary_public_id="map-routes/photos/abc",
        )
        response = self.client.delete(f"/api/route/{self.route.pk}/photos/{photo.pk}/")
        self.assertEqual(response.status_code, 502)
        self.assertTrue(Photo.objects.filter(pk=photo.pk).exists())

    @patch("apps.routes.photo_views.delete_photo")
    def test_legacy_photo_without_public_id_deletes_database_record(self, delete_mock):
        photo = Photo.objects.create(route=self.route, url="https://example.com/legacy.jpg")
        response = self.client.delete(f"/api/route/{self.route.pk}/photos/{photo.pk}/")
        self.assertEqual(response.status_code, 204)
        delete_mock.assert_not_called()
        self.assertFalse(Photo.objects.filter(pk=photo.pk).exists())
