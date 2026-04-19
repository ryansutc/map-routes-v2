from rest_framework_simplejwt.tokens import RefreshToken


def store_jwt_in_session(backend, user, response, request, *args, **kwargs):
    """
    Called at the end of the social-auth pipeline.
    Stores the JWT access token in the Django session so the
    redirect view can pick it up and hand it to the SPA.
    """
    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)
    request.session['social_auth_jwt'] = access_token
    request.session['social_auth_email'] = user.email
