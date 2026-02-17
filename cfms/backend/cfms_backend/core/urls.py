from django.urls import path

from .views import auth_login, feedback_items, food_items

urlpatterns = [
    path('auth/login/', auth_login, name='auth-login'),
    path('feedback/', feedback_items, name='feedback-items'),
    path('food-items/', food_items, name='food-items'),
]
