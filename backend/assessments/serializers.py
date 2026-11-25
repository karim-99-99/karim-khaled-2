from rest_framework import serializers

from .models import (
    CollectionQuestion,
    CollectionSubLesson,
    Exam,
    ExamAnswer,
    HomeworkQuestion,
    HomeworkSubLesson,
    TeacherTest,
)


class HomeworkSubLessonSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = HomeworkSubLesson
        fields = ["id", "lesson", "order_number", "title", "question_count", "created_at"]
        read_only_fields = ["id", "created_at", "question_count"]

    def get_question_count(self, obj):
        if hasattr(obj, "_question_count"):
            return obj._question_count
        return obj.questions.filter(needs_review=False).count()


class HomeworkQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomeworkQuestion
        fields = [
            "id",
            "subject",
            "lesson",
            "section",
            "homework_sub_lesson",
            "order_number",
            "difficulty",
            "text",
            "text_image",
            "options",
            "correct_answer",
            "explanation",
            "explanation_image",
            "video_bunny_id",
            "video_timing",
            "needs_review",
            "review_notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class CollectionSubLessonSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = CollectionSubLesson
        fields = ["id", "lesson", "order_number", "title", "question_count", "created_at"]
        read_only_fields = ["id", "created_at", "question_count"]

    def get_question_count(self, obj):
        if hasattr(obj, "_question_count"):
            return obj._question_count
        return obj.questions.filter(needs_review=False).count()


class CollectionQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CollectionQuestion
        fields = [
            "id",
            "group",
            "subject",
            "lesson",
            "sub_lesson",
            "order_number",
            "difficulty",
            "question_year",
            "teacher_tier",
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
            "needs_review",
            "review_notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        sub_lesson = attrs.get("sub_lesson", getattr(self.instance, "sub_lesson", None))
        lesson = attrs.get("lesson", getattr(self.instance, "lesson", None))
        if sub_lesson is not None and lesson is not None and sub_lesson.lesson_id != lesson.id:
            raise serializers.ValidationError(
                {"sub_lesson": "الدرس الفرعي لا ينتمي لهذا الدرس"}
            )
        return attrs

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
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    lesson_title = serializers.CharField(source="lesson.title", read_only=True)
    difficulty_label = serializers.SerializerMethodField()

    class Meta:
        model = CollectionQuestion
        fields = [
            "id",
            "text",
            "text_image",
            "options",
            "video_before",
            "video_bunny_id",
            "difficulty",
            "difficulty_label",
            "subject_name",
            "lesson_title",
            "question_year",
            "teacher_tier",
        ]

    def get_video_before(self, obj):
        return obj.video_timing == CollectionQuestion.VideoTiming.BEFORE

    def get_difficulty_label(self, obj):
        return dict(CollectionQuestion.Difficulty.choices).get(obj.difficulty, obj.difficulty)


class HomeworkPublicSerializer(serializers.ModelSerializer):
    """Homework question shown to a student (no correct answer leaked)."""

    lesson_title = serializers.CharField(source="lesson.title", read_only=True)
    section_title = serializers.SerializerMethodField()

    class Meta:
        model = HomeworkQuestion
        fields = [
            "id",
            "lesson",
            "lesson_title",
            "section",
            "section_title",
            "text",
            "text_image",
            "options",
            "explanation",
            "explanation_image",
            "video_bunny_id",
            "video_timing",
        ]

    def get_section_title(self, obj):
        return obj.section.title if obj.section_id else ""


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
    difficulty = serializers.CharField(source="question.difficulty", read_only=True)
    difficulty_label = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source="question.subject.name", read_only=True)
    lesson_title = serializers.CharField(source="question.lesson.title", read_only=True)
    question_year = serializers.CharField(source="question.question_year", read_only=True)

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
            "difficulty",
            "difficulty_label",
            "subject_name",
            "lesson_title",
            "question_year",
        ]

    def get_written_correction(self, obj):
        q = obj.question
        return getattr(q, "written_correction", None) or getattr(q, "explanation", "") or ""

    def get_explanation_image(self, obj):
        return getattr(obj.question, "explanation_image", "") or ""

    def get_difficulty_label(self, obj):
        d = obj.question.difficulty
        return dict(CollectionQuestion.Difficulty.choices).get(d, d)


class ExamSerializer(serializers.ModelSerializer):
    title = serializers.CharField(read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    subject_theme_key = serializers.SerializerMethodField()
    correct_count = serializers.SerializerMethodField()
    wrong_count = serializers.SerializerMethodField()
    answered_count = serializers.SerializerMethodField()
    unanswered_count = serializers.SerializerMethodField()
    ends_at = serializers.DateTimeField(read_only=True)
    section_size = serializers.SerializerMethodField()
    section_count = serializers.SerializerMethodField()
    sections_locked = serializers.SerializerMethodField()
    break_seconds = serializers.SerializerMethodField()
    duration_mode = serializers.SerializerMethodField()
    seconds_per_question = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = [
            "id",
            "title",
            "subject",
            "subject_name",
            "subject_theme_key",
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
            "answered_count",
            "unanswered_count",
            "started_at",
            "finished_at",
            "last_question_index",
            "section_size",
            "section_count",
            "sections_locked",
            "current_section",
            "break_pending",
            "break_started_at",
            "break_seconds",
            "duration_mode",
            "seconds_per_question",
        ]
        read_only_fields = [
            "section_size",
            "section_count",
            "sections_locked",
            "break_seconds",
            "duration_mode",
            "seconds_per_question",
        ]

    def get_section_size(self, obj):
        return obj.section_size

    def get_section_count(self, obj):
        return obj.section_count()

    def get_sections_locked(self, obj):
        return obj.sections_locked

    def get_break_seconds(self, obj):
        if not obj.sections_locked:
            return None
        return Exam.SECTION_BREAK_SECONDS

    def get_duration_mode(self, obj):
        tt = getattr(obj, "teacher_test", None)
        if tt and obj.exam_type == Exam.Type.TEACHER:
            return tt.duration_mode
        return "whole"

    def get_seconds_per_question(self, obj):
        tt = getattr(obj, "teacher_test", None)
        if (
            tt
            and obj.exam_type == Exam.Type.TEACHER
            and tt.duration_mode == "per_question"
        ):
            return int(tt.duration_value or 90)
        return None

    def get_subject_theme_key(self, obj):
        subject = getattr(obj, "subject", None)
        return getattr(subject, "theme_key", "") or ""

    def get_correct_count(self, obj):
        if hasattr(obj, "_ann_correct"):
            return obj._ann_correct
        return obj.answers.filter(is_correct=True).count()

    def get_wrong_count(self, obj):
        if hasattr(obj, "_ann_wrong"):
            return obj._ann_wrong
        return obj.answers.filter(is_correct=False, skipped=False).exclude(
            selected_answer=""
        ).count()

    def get_answered_count(self, obj):
        if hasattr(obj, "_ann_answered"):
            return obj._ann_answered
        return obj.answers.filter(skipped=False).exclude(selected_answer="").count()

    def get_unanswered_count(self, obj):
        if hasattr(obj, "_ann_unanswered"):
            return obj._ann_unanswered
        total = obj.question_count or obj.answers.count()
        return max(0, total - self.get_answered_count(obj))


class TeacherTestSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()
    lesson_ids = serializers.SerializerMethodField()
    lesson_titles = serializers.SerializerMethodField()
    question_ids = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    created_by_name = serializers.CharField(
        source="created_by.full_name", read_only=True, default=""
    )

    group_ids = serializers.SerializerMethodField()

    class Meta:
        model = TeacherTest
        fields = [
            "id",
            "name",
            "subject",
            "subject_name",
            "review_mode",
            "is_published",
            "question_count",
            "lesson_ids",
            "lesson_titles",
            "question_ids",
            "group_ids",
            "opens_at",
            "closes_at",
            "duration_mode",
            "duration_value",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "subject_name"]

    def get_group_ids(self, obj):
        return list(obj.groups.values_list("id", flat=True))

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
    group_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )
    opens_at = serializers.DateTimeField(required=False, allow_null=True)
    closes_at = serializers.DateTimeField(required=False, allow_null=True)
    duration_mode = serializers.ChoiceField(
        choices=["whole", "per_question"], default="whole", required=False
    )
    duration_value = serializers.IntegerField(required=False, min_value=1, default=60)
