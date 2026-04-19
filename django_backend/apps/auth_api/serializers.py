from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match.")
        return data


class AuthStatusSerializer(serializers.Serializer):
    is_authenticated = serializers.BooleanField()
    user_name = serializers.CharField(allow_null=True)


class JwtAuthResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    token = serializers.CharField()
    user_id = serializers.IntegerField()
    email = serializers.EmailField()
