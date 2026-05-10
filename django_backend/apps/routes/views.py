"""Views for listing, creating, and managing routes."""

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework import generics, permissions
from rest_framework.request import Request
from rest_framework.serializers import Serializer

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
