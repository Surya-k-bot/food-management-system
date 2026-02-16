from django.urls import path

from .views import food_items

urlpatterns = [
    path('food-items/', food_items, name='food-items'),
]
