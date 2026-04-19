from rest_framework import generics, permissions
from django.db.models import Q
from drf_spectacular.utils import extend_schema
from .models import Route
from .serializers import RouteSerializer, RouteWriteSerializer


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return obj.is_public or obj.owner == request.user.email
        return obj.owner == request.user.email


class RouteListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RouteWriteSerializer
        return RouteSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            return Route.objects.filter(
                Q(owner=user.email) | Q(is_public=True)
            ).prefetch_related('photos').order_by('-activity_date')
        return Route.objects.filter(is_public=True).prefetch_related('photos').order_by('-activity_date')

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user.email)


class RouteDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    queryset = Route.objects.prefetch_related('photos').all()

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return RouteWriteSerializer
        return RouteSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            return Route.objects.filter(
                Q(owner=user.email) | Q(is_public=True)
            ).prefetch_related('photos')
        return Route.objects.filter(is_public=True).prefetch_related('photos')
