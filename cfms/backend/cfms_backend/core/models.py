from django.db import models


class FoodItem(models.Model):
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=80)
    quantity = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.name} ({self.category})"


class Feedback(models.Model):
    student_name = models.CharField(max_length=150)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.student_name}: {self.message[:40]}"
