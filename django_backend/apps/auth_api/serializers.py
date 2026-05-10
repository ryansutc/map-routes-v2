"""Serializers for authentication request and response data."""

from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    """Serializer for JWT login credentials."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class RegisterSerializer(serializers.Serializer):
    """Serializer for new user registration data."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        """Ensure password and confirm_password fields match."""
        if data["password"] != data["confirm_password"]:
            raise serializers.ValidationError("Passwords do not match.")
        return data


class AuthStatusSerializer(serializers.Serializer):
    """Serializer for the current authentication status response."""

    is_authenticated = serializers.BooleanField()
    user_name = serializers.CharField(allow_null=True)


class JwtAuthResponseSerializer(serializers.Serializer):
    """Serializer for a successful JWT authentication response."""

    message = serializers.CharField()
    token = serializers.CharField()
    user_id = serializers.IntegerField()
    email = serializers.EmailField()
