from rest_framework import serializers

from .models import (
    CollectionQuestion,
    Exam,
    ExamAnswer,
    HomeworkQuestion,
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
            "options",
            "correct_answer",
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
            "options",
            "correct_answer",
            "written_correction",
            "video_bunny_id",
            "video_timing",
            "free_order",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class QuestionPublicSerializer(serializers.ModelSerializer):
    """Question as delivered to a student during an exam (no correct answer)."""

    video_before = serializers.SerializerMethodField()

    class Meta:
        model = CollectionQuestion
        fields = ["id", "text", "options", "video_before", "video_bunny_id"]

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
            "options",
            "video_bunny_id",
            "video_timing",
        ]


class ExamAnswerReviewSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source="question.text", read_only=True)
    options = serializers.JSONField(source="question.options", read_only=True)
    correct_answer = serializers.CharField(
        source="question.correct_answer", read_only=True
    )
    written_correction = serializers.CharField(
        source="question.written_correction", read_only=True
    )
    video_bunny_id = serializers.CharField(
        source="question.video_bunny_id", read_only=True
    )

    class Meta:
        model = ExamAnswer
        fields = [
            "id",
            "order",
            "question_text",
            "options",
            "selected_answer",
            "correct_answer",
            "is_correct",
            "skipped",
            "written_correction",
            "video_bunny_id",
        ]


class ExamSerializer(serializers.ModelSerializer):
    title = serializers.CharField(read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    correct_count = serializers.SerializerMethodField()
    wrong_count = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = [
            "id",
            "title",
            "subject_name",
            "exam_type",
            "difficulty_preset",
            "review_mode",
            "question_count",
            "is_free_attempt",
            "status",
            "score_percent",
            "correct_count",
            "wrong_count",
            "started_at",
            "finished_at",
        ]

    def get_correct_count(self, obj):
        return obj.answers.filter(is_correct=True).count()

    def get_wrong_count(self, obj):
        return obj.answers.filter(is_correct=False, skipped=False).count()
