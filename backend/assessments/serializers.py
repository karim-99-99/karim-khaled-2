from rest_framework import serializers

from .models import (
    CollectionQuestion,
    Exam,
    ExamAnswer,
    HomeworkQuestion,
    TeacherTest,
)


class HomeworkQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomeworkQuestion
        fields = [
            "id",
            "group",
            "subject",
            "lesson",
            "difficulty",
            "text",
            "text_image",
            "options",
            "correct_answer",
            "explanation",
            "explanation_image",
            "video_bunny_id",
            "video_timing",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class CollectionQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CollectionQuestion
        fields = [
            "id",
            "group",
            "subject",
            "lesson",
            "difficulty",
            "text",
            "text_image",
            "options",
            "correct_answer",
            "explanation",
            "explanation_image",
            "written_correction",
            "video_bunny_id",
            "video_timing",
            "free_order",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        explanation = validated_data.get("explanation") or ""
        if explanation and not validated_data.get("written_correction"):
            validated_data["written_correction"] = explanation
        return super().create(validated_data)

    def update(self, instance, validated_data):
        explanation = validated_data.get("explanation")
        if explanation is not None and "written_correction" not in validated_data:
            validated_data["written_correction"] = explanation
        return super().update(instance, validated_data)


class QuestionPublicSerializer(serializers.ModelSerializer):
    """Question as delivered to a student during an exam (no correct answer)."""

    video_before = serializers.SerializerMethodField()

    class Meta:
        model = CollectionQuestion
        fields = [
            "id",
            "text",
            "text_image",
            "options",
            "video_before",
            "video_bunny_id",
        ]

    def get_video_before(self, obj):
        return obj.video_timing == CollectionQuestion.VideoTiming.BEFORE


class HomeworkPublicSerializer(serializers.ModelSerializer):
    """Homework question shown to a student (no correct answer leaked)."""

    lesson_title = serializers.CharField(source="lesson.title", read_only=True)

    class Meta:
        model = HomeworkQuestion
        fields = [
            "id",
            "lesson",
            "lesson_title",
            "text",
            "text_image",
            "options",
            "explanation",
            "explanation_image",
            "video_bunny_id",
            "video_timing",
        ]


class ExamAnswerReviewSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source="question.text", read_only=True)
    text_image = serializers.CharField(source="question.text_image", read_only=True)
    options = serializers.JSONField(source="question.options", read_only=True)
    correct_answer = serializers.CharField(
        source="question.correct_answer", read_only=True
    )
    written_correction = serializers.SerializerMethodField()
    explanation_image = serializers.SerializerMethodField()
    video_bunny_id = serializers.CharField(
        source="question.video_bunny_id", read_only=True
    )

    class Meta:
        model = ExamAnswer
        fields = [
            "id",
            "order",
            "question_text",
            "text_image",
            "options",
            "selected_answer",
            "correct_answer",
            "is_correct",
            "skipped",
            "written_correction",
            "explanation_image",
            "video_bunny_id",
        ]

    def get_written_correction(self, obj):
        q = obj.question
        return getattr(q, "written_correction", None) or getattr(q, "explanation", "") or ""

    def get_explanation_image(self, obj):
        return getattr(obj.question, "explanation_image", "") or ""


class ExamSerializer(serializers.ModelSerializer):
    title = serializers.CharField(read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    correct_count = serializers.SerializerMethodField()
    wrong_count = serializers.SerializerMethodField()
    ends_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Exam
        fields = [
            "id",
            "title",
            "subject",
            "subject_name",
            "exam_type",
            "difficulty_preset",
            "review_mode",
            "question_count",
            "is_free_attempt",
            "time_limit_minutes",
            "ends_at",
            "status",
            "score_percent",
            "correct_count",
            "wrong_count",
            "started_at",
            "finished_at",
        ]

    def get_correct_count(self, obj):
        if hasattr(obj, "_ann_correct"):
            return obj._ann_correct
        return obj.answers.filter(is_correct=True).count()

    def get_wrong_count(self, obj):
        if hasattr(obj, "_ann_wrong"):
            return obj._ann_wrong
        return obj.answers.filter(is_correct=False, skipped=False).count()


class TeacherTestSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()
    lesson_ids = serializers.SerializerMethodField()
    lesson_titles = serializers.SerializerMethodField()
    question_ids = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(
        source="created_by.full_name", read_only=True, default=""
    )

    class Meta:
        model = TeacherTest
        fields = [
            "id",
            "name",
            "subject",
            "review_mode",
            "is_published",
            "question_count",
            "lesson_ids",
            "lesson_titles",
            "question_ids",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_at"]

    def get_question_count(self, obj):
        return obj.items.count()

    def get_lesson_ids(self, obj):
        return list(obj.lesson_links.values_list("lesson_id", flat=True))

    def get_lesson_titles(self, obj):
        return list(
            obj.lesson_links.select_related("lesson").values_list("lesson__title", flat=True)
        )

    def get_question_ids(self, obj):
        return list(obj.items.order_by("order").values_list("question_id", flat=True))


class TeacherTestWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    subject = serializers.IntegerField()
    lesson_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )
    question_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )
    review_mode = serializers.ChoiceField(
        choices=["immediate", "final"], default="final"
    )
    is_published = serializers.BooleanField(default=True)
