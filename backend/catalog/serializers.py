from django.db.models import Count, Q
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


def _difficulty_counts_from(obj):
    """Prefer queryset annotations; fall back to zeros (avoid N+1 on lists)."""
    if hasattr(obj, "_cq_easy"):
        return {
            "easy": obj._cq_easy or 0,
            "medium": obj._cq_medium or 0,
            "hard": obj._cq_hard or 0,
        }
    return {"easy": 0, "medium": 0, "hard": 0}


class LessonListSerializer(serializers.ModelSerializer):
    """Lightweight list payload — no nested sections (big win for courses pages)."""

    subject_name = serializers.CharField(source="subject.name", read_only=True)
    is_locked = serializers.SerializerMethodField()
    sections_count = serializers.SerializerMethodField()
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
        return _difficulty_counts_from(obj)


class LessonSerializer(LessonListSerializer):
    """Detail payload — includes nested sections."""

    sections = LessonSectionSerializer(many=True, read_only=True)

    class Meta(LessonListSerializer.Meta):
        fields = LessonListSerializer.Meta.fields + ["sections"]

    def get_collection_difficulty_counts(self, obj):
        counts = _difficulty_counts_from(obj)
        if hasattr(obj, "_cq_easy"):
            return counts
        # Single-lesson retrieve without annotate: one query is acceptable.
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


def annotate_lesson_list(qs):
    """Annotate section + collection difficulty counts in one SQL query."""
    return qs.annotate(
        _sections_count=Count("sections", distinct=True),
        _cq_easy=Count(
            "collectionquestions",
            filter=Q(collectionquestions__difficulty="easy"),
            distinct=True,
        ),
        _cq_medium=Count(
            "collectionquestions",
            filter=Q(collectionquestions__difficulty="medium"),
            distinct=True,
        ),
        _cq_hard=Count(
            "collectionquestions",
            filter=Q(collectionquestions__difficulty="hard"),
            distinct=True,
        ),
    )
