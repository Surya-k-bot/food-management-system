from django.urls import path

from .views import auth_login, food_items

urlpatterns = [
    path('auth/login/', auth_login, name='auth-login'),
    path('food-items/', food_items, name='food-items'),
]
