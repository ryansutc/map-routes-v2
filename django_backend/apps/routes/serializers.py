"""Serializers for the Route and Photo models."""

from rest_framework import serializers

from .models import Photo, Route


class PhotoSerializer(serializers.ModelSerializer):
    """Serializer for the Photo model."""

    class Meta:
        """Meta options for PhotoSerializer."""

        model = Photo
        fields = ["id", "title", "url", "latitude", "longitude", "route_id"]


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
            "notes",
            "route_link",
            "owner",
            "is_public",
            "photos",
        ]
        read_only_fields = ["owner"]


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
            "notes",
            "route_link",
            "is_public",
        ]
