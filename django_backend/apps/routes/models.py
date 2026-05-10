"""Database models for routes and photos."""

from django.db import models


class Route(models.Model):
    """A map route with activity metadata and optional photos."""

    title = models.CharField(max_length=255, null=True, blank=True)
    activity_date = models.DateTimeField()
    activity_type = models.CharField(max_length=100)
    distance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(null=True, blank=True)
    route_link = models.CharField(max_length=500, null=True, blank=True)
    owner = models.EmailField()
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        """Meta options for the Route model."""

        db_table = "Route"

    def __str__(self):
        """Return the route title or a fallback string."""
        return self.title or f"Route {self.id}"


class Photo(models.Model):
    """A photo associated with a route, including geolocation."""

    title = models.CharField(max_length=255, null=True, blank=True)
    url = models.CharField(max_length=1000)
    latitude = models.FloatField(default=0)
    longitude = models.FloatField(default=0)
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="photos")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        """Meta options for the Photo model."""

        db_table = "Photo"

    def __str__(self):
        """Return the photo title or a fallback string."""
        return self.title or f"Photo {self.id}"
