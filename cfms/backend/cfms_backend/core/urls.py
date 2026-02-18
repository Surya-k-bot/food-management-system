from django.urls import path

from .views import (
    auth_login,
    export_feedback_csv,
    export_feedback_pdf,
    export_food_csv,
    export_food_pdf,
    feedback_analytics,
    feedback_items,
    food_items,
    food_item_detail,
)

urlpatterns = [
    path('auth/login/', auth_login, name='auth-login'),
    path('analytics/feedback/', feedback_analytics, name='feedback-analytics'),
    path('feedback/', feedback_items, name='feedback-items'),
    path('food-items/', food_items, name='food-items'),
    path('food-items/<int:item_id>/', food_item_detail, name='food-item-detail'),
    path('reports/food-items.csv', export_food_csv, name='export-food-csv'),
    path('reports/feedback.csv', export_feedback_csv, name='export-feedback-csv'),
    path('reports/food-items.pdf', export_food_pdf, name='export-food-pdf'),
    path('reports/feedback.pdf', export_feedback_pdf, name='export-feedback-pdf'),
]
