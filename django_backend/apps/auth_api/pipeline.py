"""Custom social-auth pipeline steps for JWT session storage."""

from typing import Any

from django.http import HttpRequest
from rest_framework_simplejwt.tokens import RefreshToken


def store_jwt_in_session(
    backend: Any,
    user: Any,
    response: Any,
    request: HttpRequest,
    *args: Any,
    **kwargs: Any,
) -> None:
    """Store a JWT access token in the session at the end of the social-auth pipeline."""
    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)
    request.session["social_auth_jwt"] = access_token
    request.session["social_auth_email"] = user.email
