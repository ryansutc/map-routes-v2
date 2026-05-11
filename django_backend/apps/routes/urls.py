"""URL patterns for the routes application."""

from django.urls import path

from . import views

urlpatterns = [
    path("", views.RouteListCreateView.as_view(), name="route-list"),
    path("<int:pk>/", views.RouteDetailView.as_view(), name="route-detail"),
    path("parse-gpx/", views.ParseGpxView.as_view(), name="parse-gpx"),
]
