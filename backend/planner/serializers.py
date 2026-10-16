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


class StudyPlanSerializer(serializers.ModelSerializer):
    tasks = StudyPlanTaskSerializer(many=True, read_only=True)
    done_count = serializers.SerializerMethodField()
    total_count = serializers.SerializerMethodField()
    today_day_index = serializers.SerializerMethodField()

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
        from django.utils import timezone

        today = timezone.localdate()
        delta = (today - obj.start_date).days + 1
        if delta < 1:
            return 1
        if delta > obj.days_count:
            return obj.days_count
        return delta


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
        ]
