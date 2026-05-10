"""Admin registration for routes models."""

from django.contrib import admin

from .models import Photo, Route


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    """Admin interface for the Route model."""

    list_display = ["title", "owner", "is_public", "activity_date"]
    list_filter = ["is_public", "activity_date"]
    search_fields = ["title", "owner"]


@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    """Admin interface for the Photo model."""

    list_display = ["title", "route", "latitude", "longitude"]
    list_filter = ["route"]
    search_fields = ["title"]
