from django.contrib import admin
from .models import Route, Photo


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ['title', 'owner', 'is_public', 'activity_date']
    list_filter = ['is_public', 'activity_date']
    search_fields = ['title', 'owner']


@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    list_display = ['title', 'route', 'latitude', 'longitude']
    list_filter = ['route']
    search_fields = ['title']
