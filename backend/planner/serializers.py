from rest_framework import serializers

from .models import StudyPlan, StudyPlanTask


class StudyPlanTaskSerializer(serializers.ModelSerializer):
    subject_name = serializers.SerializerMethodField()
    lesson_title = serializers.SerializerMethodField()

    class Meta:
        model = StudyPlanTask
        fields = [
            "id",
            "day_index",
            "task_date",
            "kind",
            "subject",
            "subject_name",
            "lesson",
            "lesson_title",
            "title",
            "detail",
            "estimated_minutes",
            "order_on_day",
            "is_done",
            "done_at",
        ]
        read_only_fields = fields

    def get_subject_name(self, obj):
        return obj.subject.name if obj.subject_id else ""

    def get_lesson_title(self, obj):
        return obj.lesson.title if obj.lesson_id else ""


def _today_day_index(plan):
    from django.utils import timezone

    today = timezone.localdate()
    delta = (today - plan.start_date).days + 1
    if delta < 1:
        return 1
    if delta > plan.days_count:
        return plan.days_count
    return delta


class StudyPlanSerializer(serializers.ModelSerializer):
    tasks = StudyPlanTaskSerializer(many=True, read_only=True)
    done_count = serializers.SerializerMethodField()
    total_count = serializers.SerializerMethodField()
    today_day_index = serializers.SerializerMethodField()
    overdue_count = serializers.SerializerMethodField()
    remaining_days = serializers.SerializerMethodField()

    class Meta:
        model = StudyPlan
        fields = [
            "id",
            "title",
            "start_date",
            "days_count",
            "hours_per_day",
            "include_foundation",
            "include_collections",
            "subject_ids",
            "exam_date",
            "is_active",
            "created_at",
            "done_count",
            "total_count",
            "today_day_index",
            "overdue_count",
            "remaining_days",
            "tasks",
        ]
        read_only_fields = fields

    def get_done_count(self, obj):
        if hasattr(obj, "_done_count"):
            return obj._done_count
        return obj.tasks.filter(is_done=True).count()

    def get_total_count(self, obj):
        if hasattr(obj, "_total_count"):
            return obj._total_count
        return obj.tasks.count()

    def get_today_day_index(self, obj):
        return _today_day_index(obj)

    def get_overdue_count(self, obj):
        """مهام غير منتهية في أيام فاتت قبل اليوم الحالي."""
        today_i = _today_day_index(obj)
        return obj.tasks.filter(is_done=False, day_index__lt=today_i).count()

    def get_remaining_days(self, obj):
        return obj.days_count - _today_day_index(obj) + 1


class StudyPlanSummarySerializer(StudyPlanSerializer):
    class Meta(StudyPlanSerializer.Meta):
        fields = [
            "id",
            "title",
            "start_date",
            "days_count",
            "hours_per_day",
            "include_foundation",
            "include_collections",
            "subject_ids",
            "exam_date",
            "is_active",
            "created_at",
            "done_count",
            "total_count",
            "today_day_index",
            "overdue_count",
            "remaining_days",
        ]
