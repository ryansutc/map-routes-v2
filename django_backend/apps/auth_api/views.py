"""Views for JWT authentication and Google OAuth2 login."""

from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.base_user import AbstractBaseUser
from django.http import HttpRequest, HttpResponseRedirect
from django.shortcuts import redirect
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    AuthStatusSerializer,
    JwtAuthResponseSerializer,
    LoginSerializer,
    RegisterSerializer,
)

User = get_user_model()


def get_tokens_for_user(user: AbstractBaseUser) -> str:
    """Return a JWT access token string for the given user."""
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


class LoginJwtView(APIView):
    """API view to authenticate a user and return a JWT token."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(request=LoginSerializer, responses=JwtAuthResponseSerializer)
    def post(self, request: Request) -> Response:
        """Authenticate with email and password and return a JWT access token."""
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        if not user:
            return Response({"message": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        token = get_tokens_for_user(user)
        return Response(
            {
                "message": "Login successful",
                "token": token,
                "user_id": user.id,
                "email": user.email,
            }
        )


class RegisterJwtView(APIView):
    """API view to register a new user and return a JWT token."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(request=RegisterSerializer, responses=JwtAuthResponseSerializer)
    def post(self, request: Request) -> Response:
        """Register a new user account and return a JWT access token."""
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]

        if User.objects.filter(email=email).exists():
            return Response(
                {"message": "Email already registered"}, status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.create_user(username=email, email=email, password=password)
        token = get_tokens_for_user(user)
        return Response(
            {
                "message": "Registration successful",
                "token": token,
                "user_id": user.id,
                "email": user.email,
            },
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    """API view to log out the current user."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: {"description": "Logout successful"}})
    def post(self, request: Request) -> Response:
        """Return a logout confirmation response."""
        return Response({"message": "Logout successful"})


class AuthStatusView(APIView):
    """API view to check whether the current request is authenticated."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(responses=AuthStatusSerializer)
    def get(self, request: Request) -> Response:
        """Return authentication status and email for the current user."""
        return Response(
            {
                "is_authenticated": request.user.is_authenticated,
                "user_name": request.user.email if request.user.is_authenticated else None,
            }
        )


class GoogleLoginRedirectView(APIView):
    """API view that redirects the user to the Google OAuth2 login page."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(responses={302: {"description": "Redirect to Google OAuth login"}})
    def get(self, request: Request) -> HttpResponseRedirect:
        """Redirect to the Google OAuth2 login URL."""
        return redirect("/social/login/google-oauth2/")


@method_decorator(csrf_exempt, name="dispatch")
class GoogleCallbackView(View):
    """View that handles the post-OAuth callback and forwards the JWT to the SPA."""

    def get(self, request: HttpRequest) -> HttpResponseRedirect:
        """Read the JWT from the session and redirect to the frontend with the token."""
        token = request.session.pop("social_auth_jwt", None)
        email = request.session.pop("social_auth_email", None)
        frontend_url = settings.FRONTEND_URL

        if token and email:
            params = urlencode({"token": token, "email": email})
            return redirect(f"{frontend_url}/auth/callback#{params}")
        return redirect(f"{frontend_url}/?auth_error=oauth_failed")
