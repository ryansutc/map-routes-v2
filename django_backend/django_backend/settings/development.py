from .base import *

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
]

SOCIAL_AUTH_ALLOWED_REDIRECT_HOSTS = ["localhost:5173", "127.0.0.1:5173"]
