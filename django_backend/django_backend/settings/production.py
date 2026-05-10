"""Production Django settings with security hardening."""

from decouple import config

from .base import *

DEBUG = False

ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="").split(",")

CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", default="").split(",")

SOCIAL_AUTH_ALLOWED_REDIRECT_HOSTS = config("SOCIAL_AUTH_ALLOWED_REDIRECT_HOSTS", default="").split(
    ","
)

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
