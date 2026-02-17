from django.contrib import admin

from .models import Feedback, FoodItem


@admin.register(FoodItem)
class FoodItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'quantity', 'image', 'created_at')
    search_fields = ('name', 'category')


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ('student_name', 'food_item', 'rating', 'message', 'created_at')
    search_fields = ('student_name', 'message', 'food_item__name')
