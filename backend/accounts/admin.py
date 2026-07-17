from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    ordering = ["-created_at"]
    list_display = ["email", "full_name", "phone", "role", "is_active"]
    list_filter = ["role", "is_active"]
    search_fields = ["email", "full_name", "phone"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("المعلومات", {"fields": ("full_name", "phone", "gender", "role")}),
        ("الصلاحيات", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "full_name", "phone", "gender", "role", "password1", "password2"),
            },
        ),
    )
