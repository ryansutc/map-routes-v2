"""Views for listing, creating, and managing routes."""

import json
from typing import Any

from django.conf import settings
from django.db.models import Q, QuerySet
from rest_framework import generics, permissions
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import Serializer
from rest_framework.views import APIView

from apps.shared_utils.error_utils import print_debug_error

from .arcgis import get_token, share_item_public, upload_geojson
from .gpx_utils import parse_gpx
from .models import Route
from .serializers import RouteSerializer, RouteWriteSerializer


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Allow read access to public routes; restrict writes to the owner."""

    def has_object_permission(self, request: Request, _view: Any, obj: Route) -> bool:
        """Return True if the request is safe or the user owns the object."""
        if request.method in permissions.SAFE_METHODS:
            return obj.is_public or obj.owner == request.user.email
        return obj.owner == request.user.email


class RouteListCreateView(generics.ListCreateAPIView):
    """API view to list routes visible to the user or create a new route."""

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_serializer_class(self) -> type[Serializer]:
        """Return the write serializer for POST, read serializer otherwise."""
        if self.request.method == "POST":
            return RouteWriteSerializer
        return RouteSerializer

    def get_queryset(self) -> QuerySet[Route]:
        """Return routes owned by the user plus all public routes."""
        user = self.request.user
        if user.is_authenticated:
            return (
                Route.objects.filter(Q(owner=user.email) | Q(is_public=True))
                .prefetch_related("photos")
                .order_by("-activity_date")
            )
        return (
            Route.objects.filter(is_public=True)
            .prefetch_related("photos")
            .order_by("-activity_date")
        )

    def perform_create(self, serializer: RouteWriteSerializer) -> None:
        """Save the new route with the requesting user as owner."""
        serializer.save(owner=self.request.user.email)


class RouteDetailView(generics.RetrieveUpdateDestroyAPIView):
    """API view to retrieve, update, or delete a single route."""

    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    queryset = Route.objects.prefetch_related("photos").all()

    def get_serializer_class(self) -> type[Serializer]:
        """Return the write serializer for mutating methods, read serializer otherwise."""
        if self.request.method in ("PUT", "PATCH"):
            return RouteWriteSerializer
        return RouteSerializer

    def get_queryset(self) -> QuerySet[Route]:
        """Return routes visible to the requesting user."""
        user = self.request.user
        if user.is_authenticated:
            return Route.objects.filter(Q(owner=user.email) | Q(is_public=True)).prefetch_related(
                "photos"
            )
        return Route.objects.filter(is_public=True).prefetch_related("photos")


class ParseGpxView(APIView):
    """Parse a GPX file, upload it to ArcGIS Online, and return route metadata."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request: Request) -> Response:
        """Accept a GPX file, parse it, upload to ArcGIS, and return metadata."""
        if "file" not in request.FILES:
            return Response({"detail": "No file provided."}, status=400)

        uploaded_file = request.FILES["file"]
        file_bytes = uploaded_file.read()
        title = uploaded_file.name.removesuffix(".gpx") or "map-routes-gpx-upload"

        try:
            parsed = parse_gpx(file_bytes)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        username = settings.ARCGIS_USERNAME
        password = settings.ARCGIS_PASSWORD
        if not username or not password:
            return Response({"detail": "ArcGIS credentials not configured."}, status=502)

        try:
            token = get_token(username, password)
            geojson_str = json.dumps(parsed["geojson"])
            item_id = upload_geojson(token, username, geojson_str, title=title)
            share_item_public(token, username, item_id)
        except Exception as exc:
            print_debug_error()
            return Response({"detail": f"ArcGIS error: {exc}"}, status=502)

        return Response(
            {
                "arcgis_item_id": item_id,
                "geojson": parsed["geojson"],
                "date": parsed["date"],
                "distance_m": parsed["distance_m"],
                "duration_s": parsed["duration_s"],
                "avg_pace_decimal": parsed["avg_pace_decimal"],
                "elevation_gain_m": parsed["elevation_gain_m"],
            }
        )
