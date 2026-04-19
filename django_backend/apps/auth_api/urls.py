from django.urls import path
from . import views

urlpatterns = [
    path('login-jwt/', views.LoginJwtView.as_view(), name='login-jwt'),
    path('register-jwt/', views.RegisterJwtView.as_view(), name='register-jwt'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('status/', views.AuthStatusView.as_view(), name='auth-status'),
    path('google/', views.GoogleLoginRedirectView.as_view(), name='google-login'),
    path('google/callback/', views.GoogleCallbackView.as_view(), name='google-callback'),
]
