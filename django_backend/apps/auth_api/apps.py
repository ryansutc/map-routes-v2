"""AppConfig for the auth_api application."""

from django.apps import AppConfig


class AuthApiConfig(AppConfig):
    """Django app configuration for auth_api."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.auth_api"
