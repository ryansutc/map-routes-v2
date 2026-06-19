"""Database models for routes and photos."""

from django.db import models


class ActivityType(models.TextChoices):
    """Enumeration of supported activity types."""

    HIKING = "Hiking"
    RUNNING = "Running"
    CYCLING = "Cycling"
    BACKPACKING = "Backpacking"
    SKIING = "Skiing"
    OTHER = "Other"


class Route(models.Model):
    """A map route with activity metadata and optional photos."""

    title = models.CharField(max_length=255, null=True, blank=True)
    activity_date = models.DateTimeField()
    activity_type = models.CharField(max_length=20, choices=ActivityType, null=True, blank=True)
    distance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    duration = models.IntegerField(null=True, blank=True)
    avg_pace = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    elevation_gain = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    arcgis_item_id = models.CharField(max_length=32, null=True, blank=True)
    geojson = models.JSONField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    route_link = models.CharField(max_length=500, null=True, blank=True)
    owner = models.EmailField()
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        """Meta options for the Route model."""

        db_table = "Route"

    def __str__(self) -> str:
        """Return the route title or a fallback string."""
        return self.title or f"Route {self.id}"


class Photo(models.Model):
    """A photo associated with a route, including geolocation."""

    title = models.CharField(max_length=255, null=True, blank=True)
    url = models.CharField(max_length=1000)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    # time the photo was taken, derived from the photo metadata
    taken_at = models.DateTimeField(null=True, blank=True)
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="photos")
    # time the photo was uploaded
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        """Meta options for the Photo model."""

        db_table = "Photo"

    def __str__(self):
        """Return the photo title or a fallback string."""
        return self.title or f"Photo {self.id}"
