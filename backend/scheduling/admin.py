from django.contrib import admin

from .models import SessionAttendance


@admin.register(SessionAttendance)
class SessionAttendanceAdmin(admin.ModelAdmin):
    list_display = ("id", "session", "student", "status", "marked_at")
    list_filter = ("status",)
    search_fields = ("student__full_name", "student__email")
