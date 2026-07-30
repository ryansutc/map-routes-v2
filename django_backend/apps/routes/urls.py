"""URL patterns for the routes application."""

from django.urls import path

from . import views
from .photo_views import RoutePhotoDetailView, RoutePhotoView

urlpatterns = [
    path("", views.RouteListCreateView.as_view(), name="route-list"),
    path("<int:pk>/", views.RouteDetailView.as_view(), name="route-detail"),
    path("<int:pk>/photos/", RoutePhotoView.as_view(), name="route-photos"),
    path(
        "<int:pk>/photos/<int:photo_pk>/",
        RoutePhotoDetailView.as_view(),
        name="route-photo-detail",
    ),
    path("parse-gpx/", views.ParseGpxView.as_view(), name="parse-gpx"),
]
