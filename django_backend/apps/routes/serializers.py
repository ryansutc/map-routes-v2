"""Serializers for the Route and Photo models."""

from rest_framework import serializers

from .models import Photo, Route


class PhotoSerializer(serializers.ModelSerializer):
    """Serializer for the Photo model."""

    has_gps = serializers.SerializerMethodField()

    class Meta:
        """Meta options for PhotoSerializer."""

        model = Photo
        fields = ["id", "title", "url", "latitude", "longitude", "route_id", "has_gps"]

    def get_has_gps(self, obj: Photo) -> bool:
        """Return True if the photo has GPS coordinates."""
        return obj.latitude is not None and obj.longitude is not None


class RouteSerializer(serializers.ModelSerializer):
    """Serializer for reading Route instances, including nested photos."""

    photos = PhotoSerializer(many=True, read_only=True)
    distance = serializers.FloatField()

    class Meta:
        """Meta options for RouteSerializer."""

        model = Route
        fields = [
            "id",
            "title",
            "activity_date",
            "activity_type",
            "distance",
            "duration",
            "avg_pace",
            "elevation_gain",
            "arcgis_item_id",
            "geojson",
            "notes",
            "route_link",
            "owner",
            "is_public",
            "photos",
            "created_at",
        ]
        read_only_fields = ["owner", "created_at"]


class ParseGpxRequestSerializer(serializers.Serializer):
    """Serializer for the multipart file upload accepted by ParseGpxView."""

    file = serializers.FileField()


class ParseGpxResponseSerializer(serializers.Serializer):
    """Serializer for the response returned by ParseGpxView."""

    arcgis_item_id = serializers.CharField()
    geojson = serializers.JSONField()
    date = serializers.DateTimeField()
    distance_m = serializers.FloatField()
    duration_s = serializers.FloatField(allow_null=True)
    avg_pace_decimal = serializers.FloatField(allow_null=True)
    elevation_gain_m = serializers.FloatField(allow_null=True)


class RouteWriteSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating Route instances."""

    distance = serializers.FloatField()

    class Meta:
        """Meta options for RouteWriteSerializer."""

        model = Route
        fields = [
            "id",
            "title",
            "activity_date",
            "activity_type",
            "distance",
            "duration",
            "avg_pace",
            "elevation_gain",
            "arcgis_item_id",
            "geojson",
            "notes",
            "route_link",
            "is_public",
        ]
