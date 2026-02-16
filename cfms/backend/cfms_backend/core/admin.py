from django.contrib import admin

from .models import FoodItem


@admin.register(FoodItem)
class FoodItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'quantity', 'created_at')
    search_fields = ('name', 'category')
