from rest_framework import serializers

from core.access import lesson_is_free_preview, user_has_full_content_access
from .models import Lesson, Subject


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name", "slug", "cover_gradient", "order"]


class LessonSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    is_locked = serializers.SerializerMethodField()

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
            "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "is_locked"]

    def get_is_locked(self, obj):
        """Locked for free-tier users when this is not the first/free lesson."""
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if user_has_full_content_access(user):
            return False
        return not lesson_is_free_preview(obj)
