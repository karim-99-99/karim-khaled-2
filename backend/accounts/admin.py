from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User, WhatsAppAuthSession


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    ordering = ["-created_at"]
    list_display = [
        "email",
        "full_name",
        "phone",
        "contact_channel",
        "telegram_username",
        "role",
        "is_active",
    ]
    list_filter = ["role", "is_active", "contact_channel"]
    search_fields = ["email", "full_name", "phone", "telegram_id", "telegram_username"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "المعلومات",
            {
                "fields": (
                    "full_name",
                    "phone",
                    "gender",
                    "role",
                    "contact_channel",
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


@admin.register(WhatsAppAuthSession)
class WhatsAppAuthSessionAdmin(admin.ModelAdmin):
    list_display = ["token", "status", "phone", "full_name", "created_at", "expires_at"]
    list_filter = ["status"]
    search_fields = ["token", "phone", "full_name"]
