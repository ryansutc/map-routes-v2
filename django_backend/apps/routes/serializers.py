from rest_framework import serializers
from .models import Route, Photo


class PhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Photo
        fields = ['id', 'title', 'url', 'latitude', 'longitude', 'route_id']


class RouteSerializer(serializers.ModelSerializer):
    photos = PhotoSerializer(many=True, read_only=True)
    distance = serializers.FloatField()

    class Meta:
        model = Route
        fields = [
            'id', 'title', 'activity_date', 'activity_type',
            'distance', 'notes', 'route_link', 'owner', 'is_public', 'photos'
        ]
        read_only_fields = ['owner']


class RouteWriteSerializer(serializers.ModelSerializer):
    distance = serializers.FloatField()

    class Meta:
        model = Route
        fields = [
            'id', 'title', 'activity_date', 'activity_type',
            'distance', 'notes', 'route_link', 'is_public'
        ]
