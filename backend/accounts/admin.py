from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    ordering = ["-created_at"]
    list_display = [
        "email",
        "full_name",
        "phone",
        "region",
        "school_name",
        "school_type",
        "role",
        "is_active",
    ]
    list_filter = ["role", "is_active", "region", "school_type"]
    search_fields = ["email", "full_name", "phone", "school_name", "city"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "المعلومات",
            {
                "fields": (
                    "full_name",
                    "phone",
                    "guardian_phone",
                    "gender",
                    "region",
                    "city",
                    "school_name",
                    "school_type",
                    "role",
                    "telegram_id",
                    "telegram_username",
                )
            },
        ),
        (
            "الصلاحيات",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "full_name",
                    "phone",
                    "gender",
                    "role",
                    "password1",
                    "password2",
                ),
            },
        ),
    )
