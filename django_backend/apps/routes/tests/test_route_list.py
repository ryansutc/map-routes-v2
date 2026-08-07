"""API tests for lightweight route collection responses."""

# ruff: noqa: D102

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.routes.models import Route


class RouteListApiTests(TestCase):
    """Verify collection payload shape without changing route visibility."""

    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            username="owner@example.com", email="owner@example.com", password="test"
        )
        self.other_user = get_user_model().objects.create_user(
            username="other@example.com", email="other@example.com", password="test"
        )
        self.public_route = self.create_route(
            title="Public route", owner=self.other_user.email, is_public=True
        )
        self.owner_private_route = self.create_route(
            title="Owner private route", owner=self.owner.email, is_public=False
        )
        self.other_private_route = self.create_route(
            title="Other private route", owner=self.other_user.email, is_public=False
        )
        self.client = APIClient()

    @staticmethod
    def create_route(*, title: str, owner: str, is_public: bool) -> Route:
        """Create a route containing geometry large enough to detect accidental serialization."""
        return Route.objects.create(
            title=title,
            activity_date=timezone.now(),
            activity_type="Hiking",
            distance=10,
            geojson={
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[-123, 49, index] for index in range(100)],
                        },
                        "properties": {},
                    }
                ],
            },
            owner=owner,
            is_public=is_public,
        )

    def test_anonymous_collection_omits_geometry_and_private_routes(self):
        response = self.client.get("/api/route/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([route["id"] for route in response.data], [self.public_route.pk])
        self.assertTrue(all("geojson" not in route for route in response.data))

    def test_authenticated_collection_keeps_existing_visibility_without_geometry(self):
        self.client.force_authenticate(self.owner)

        response = self.client.get("/api/route/")

        self.assertEqual(response.status_code, 200)
        returned_ids = {route["id"] for route in response.data}
        self.assertEqual(returned_ids, {self.public_route.pk, self.owner_private_route.pk})
        self.assertNotIn(self.other_private_route.pk, returned_ids)
        self.assertTrue(all("geojson" not in route for route in response.data))

    def test_authorized_detail_still_includes_canonical_geometry(self):
        response = self.client.get(f"/api/route/{self.public_route.pk}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["geojson"], self.public_route.geojson)
