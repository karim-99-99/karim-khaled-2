from django.contrib import admin

from .models import StudyPlan, StudyPlanTask


class StudyPlanTaskInline(admin.TabularInline):
    model = StudyPlanTask
    extra = 0
    fields = (
        "day_index",
        "task_date",
        "kind",
        "title",
        "estimated_minutes",
        "is_done",
    )
    readonly_fields = fields
    can_delete = False
    show_change_link = True


@admin.register(StudyPlan)
class StudyPlanAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "student",
        "title",
        "days_count",
        "hours_per_day",
        "is_active",
        "start_date",
        "created_at",
    )
    list_filter = ("is_active", "days_count")
    search_fields = ("title", "student__email", "student__full_name")
    inlines = [StudyPlanTaskInline]


@admin.register(StudyPlanTask)
class StudyPlanTaskAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "plan",
        "day_index",
        "task_date",
        "kind",
        "title",
        "is_done",
    )
    list_filter = ("kind", "is_done")
    search_fields = ("title",)
