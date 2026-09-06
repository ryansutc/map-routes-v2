"""Tests for the authentication API."""

from urllib.parse import parse_qs, urlparse

from django.test import TestCase, override_settings


class GoogleLoginTests(TestCase):
    """Tests for starting a Google OAuth login."""

    @override_settings(
        SOCIAL_AUTH_GOOGLE_OAUTH2_KEY="test-client-id",
        SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET="test-client-secret",
    )
    def test_google_login_prompts_user_to_choose_an_account(self) -> None:
        """A new sign-in must not silently reuse Google's existing session."""
        login_response = self.client.get("/api/auth/google/")

        self.assertRedirects(
            login_response,
            "/social/login/google-oauth2/",
            fetch_redirect_response=False,
        )
        response = self.client.get(login_response["Location"])

        self.assertEqual(response.status_code, 302)
        query = parse_qs(urlparse(response["Location"]).query)
        self.assertEqual(query.get("prompt"), ["select_account"])
