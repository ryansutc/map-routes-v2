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
            "track_point_count",
            "geojson",
            "notes",
            "route_link",
            "owner",
            "is_public",
            "photos",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["owner", "created_at", "updated_at"]


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
    track_point_count = serializers.IntegerField(allow_null=True)


class RouteCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating Route instances from parsed GPX data."""

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
            "track_point_count",
            "geojson",
            "notes",
            "route_link",
            "is_public",
        ]


class RouteUpdateSerializer(serializers.ModelSerializer):
    """Serializer restricted to owner-managed route information."""

    class Meta:
        """Meta options for RouteUpdateSerializer."""

        model = Route
        fields = ["title", "activity_type", "notes", "is_public"]
        extra_kwargs = {
            "title": {"allow_blank": False, "required": False},
            "activity_type": {"allow_blank": False, "required": False},
            "notes": {"allow_blank": True, "required": False},
            "is_public": {"required": False},
        }

    def to_internal_value(self, data):
        """Reject immutable and unexpected fields rather than ignoring them."""
        unexpected = sorted(set(data.keys()) - set(self.fields))
        if unexpected:
            raise serializers.ValidationError(
                {field: "This field cannot be changed." for field in unexpected}
            )
        return super().to_internal_value(data)

    def validate_title(self, value: str) -> str:
        """Require a non-empty title after trimming whitespace."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value

    def validate_notes(self, value: str) -> str:
        """Store notes without surrounding whitespace."""
        return value.strip()

    def update(self, instance: Route, validated_data: dict) -> Route:
        """Avoid saving the Route, and its auto timestamp, for a no-op patch."""
        changed_fields = [
            field for field, value in validated_data.items() if getattr(instance, field) != value
        ]
        if not changed_fields:
            return instance

        for field in changed_fields:
            setattr(instance, field, validated_data[field])
        instance.save(update_fields=[*changed_fields, "updated_at"])
        return instance


class PhotoTitleUpdateSerializer(serializers.ModelSerializer):
    """Serializer restricted to changing a photo's optional title."""

    class Meta:
        """Meta options for PhotoTitleUpdateSerializer."""

        model = Photo
        fields = ["title"]
        extra_kwargs = {"title": {"allow_blank": True, "required": True}}

    def to_internal_value(self, data):
        """Reject any attempted photo mutation other than title."""
        unexpected = sorted(set(data.keys()) - {"title"})
        if unexpected:
            raise serializers.ValidationError(
                {field: "This field cannot be changed." for field in unexpected}
            )
        return super().to_internal_value(data)

    def validate_title(self, value: str) -> str:
        """Trim photo titles; an empty value clears the title."""
        return value.strip()
