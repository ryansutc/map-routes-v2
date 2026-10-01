"""Tests for the required route title invariant."""

from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from apps.routes.models import Route


class RouteTitleApiTests(TestCase):
    """Exercise route title validation at the API boundary."""

    def setUp(self):
        """Authenticate a route owner."""
        self.user = get_user_model().objects.create_user(
            username="owner@example.com", email="owner@example.com", password="test"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_create_requires_title(self):
        """Reject a create request that omits the title."""
        response = self.client.post("/api/route/", {"distance": 1}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("title", response.data)

    def test_create_rejects_empty_and_whitespace_only_titles(self):
        """Reject titles without non-whitespace content."""
        for title in ("", "   \t\n"):
            with self.subTest(title=repr(title)):
                response = self.client.post(
                    "/api/route/", {"title": title, "distance": 1}, format="json"
                )

                self.assertEqual(response.status_code, 400)
                self.assertIn("title", response.data)

    def test_create_trims_title(self):
        """Store and return a valid title without surrounding whitespace."""
        response = self.client.post(
            "/api/route/", {"title": "  Morning ridge  ", "distance": 1}, format="json"
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["title"], "Morning ridge")
        self.assertEqual(Route.objects.get(pk=response.data["id"]).title, "Morning ridge")

    def test_create_enforces_title_max_length(self):
        """Keep the model's 255-character title limit at the API boundary."""
        response = self.client.post(
            "/api/route/", {"title": "x" * 256, "distance": 1}, format="json"
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("title", response.data)


class RouteTitleMigrationTests(TransactionTestCase):
    """Verify legacy route titles are safe before the field becomes required."""

    migrate_from = [("routes", "0009_route_activity_date_nullable")]
    migrate_to = [("routes", "0010_require_route_title")]

    def test_migration_normalizes_only_blank_titles(self):
        """Replace empty titles while preserving every non-empty title exactly."""
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps
        OldRoute = old_apps.get_model("routes", "Route")
        empty = OldRoute.objects.create(title="", distance=0, owner="owner@example.com")
        whitespace = OldRoute.objects.create(
            title=" \t\n ", distance=0, owner="owner@example.com"
        )
        existing = OldRoute.objects.create(
            title="  Existing title  ", distance=0, owner="owner@example.com"
        )

        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        new_apps = executor.loader.project_state(self.migrate_to).apps
        NewRoute = new_apps.get_model("routes", "Route")

        self.assertEqual(NewRoute.objects.get(pk=empty.pk).title, "Untitled route")
        self.assertEqual(NewRoute.objects.get(pk=whitespace.pk).title, "Untitled route")
        self.assertEqual(NewRoute.objects.get(pk=existing.pk).title, "  Existing title  ")
