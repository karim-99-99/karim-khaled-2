from rest_framework import serializers

from core.access import lesson_is_free_preview, user_has_full_content_access
from .models import Lesson, LessonSection, Subject


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name", "slug", "cover_gradient", "order"]


class LessonSectionSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source="lesson.title", read_only=True)
    subject = serializers.IntegerField(source="lesson.subject_id", read_only=True)
    subject_name = serializers.CharField(source="lesson.subject.name", read_only=True)
    is_locked = serializers.SerializerMethodField()

    class Meta:
        model = LessonSection
        fields = [
            "id",
            "lesson",
            "lesson_title",
            "subject",
            "subject_name",
            "order_number",
            "title",
            "bunny_video_id",
            "pdf_url",
            "is_locked",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "is_locked"]

    def get_is_locked(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if user_has_full_content_access(user):
            return False
        return not lesson_is_free_preview(obj.lesson)


class LessonSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    is_locked = serializers.SerializerMethodField()
    sections_count = serializers.SerializerMethodField()
    sections = LessonSectionSerializer(many=True, read_only=True)
    collection_difficulty_counts = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            "id",
            "subject",
            "subject_name",
            "created_by",
            "order_number",
            "title",
            "bunny_video_id",
            "pdf_url",
            "is_free_preview",
            "is_locked",
            "is_archived",
            "sections_count",
            "sections",
            "collection_difficulty_counts",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_at",
            "is_locked",
            "sections_count",
            "collection_difficulty_counts",
        ]

    def get_is_locked(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if user_has_full_content_access(user):
            return False
        return not lesson_is_free_preview(obj)

    def get_sections_count(self, obj):
        if hasattr(obj, "_sections_count"):
            return obj._sections_count
        return obj.sections.count()

    def get_collection_difficulty_counts(self, obj):
        from django.db.models import Count

        from assessments.models import CollectionQuestion

        rows = (
            CollectionQuestion.objects.filter(lesson_id=obj.id)
            .values("difficulty")
            .annotate(c=Count("id"))
        )
        out = {"easy": 0, "medium": 0, "hard": 0}
        for row in rows:
            key = row.get("difficulty")
            if key in out:
                out[key] = row["c"]
        return out
