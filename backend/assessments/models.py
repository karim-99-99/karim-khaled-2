from django.conf import settings
from django.db import models


class QuestionBase(models.Model):
    """
    Shared fields for both homework and collection (test-bank) questions.

    Math support: `text` and each option store plain text that MAY contain
    LaTeX fragments wrapped in $...$ (produced by the frontend equation
    toolbar). The frontend renders them with KaTeX. Nothing special is needed
    server-side beyond storing the string.

    Video support: ONE optional video per question, with a toggle deciding
    whether it is shown BEFORE or AFTER the student answers.
    """

    class VideoTiming(models.TextChoices):
        BEFORE = "before", "قبل الإجابة"
        AFTER = "after", "بعد الإجابة"

    class Difficulty(models.TextChoices):
        EASY = "easy", "سهل"
        MEDIUM = "medium", "متوسط"
        HARD = "hard", "صعب"

    # Questions are owned by the teacher (created_by) + subject + lesson.
    # Homework (تأسيس): when group is null, reaches groups where the teacher
    # teaches this subject; when set, pinned to that group.
    # Collection (تجميعات): group is always null — visible to ALL students.
    group = models.ForeignKey(
        "groups.StudyGroup",
        related_name="%(class)ss",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    subject = models.ForeignKey(
        "catalog.Subject",
        related_name="%(class)ss",
        on_delete=models.CASCADE,
    )
    lesson = models.ForeignKey(
        "catalog.Lesson",
        related_name="%(class)ss",
        on_delete=models.CASCADE,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="%(class)ss_authored",
        on_delete=models.SET_NULL,
        null=True,
    )

    text = models.TextField(help_text="Question text; may contain $LaTeX$ fragments")
    # Optional image shown under the question text (URL or data URL).
    text_image = models.TextField(blank=True, default="")
    # options: [{"key": "أ", "text": "...", "image": "...optional..."}, ...]
    options = models.JSONField(default=list)
    correct_answer = models.CharField(max_length=10, help_text="Option key, e.g. أ")

    # Written explanation / correction (homework + collection).
    explanation = models.TextField(blank=True, default="")
    explanation_image = models.TextField(blank=True, default="")

    # Every question (homework + collection) has a difficulty. It is NEVER shown
    # to students; it is used only to filter questions per level.
    difficulty = models.CharField(
        max_length=10, choices=Difficulty.choices, default=Difficulty.MEDIUM
    )

    # Single explanatory video with timing toggle.
    video_bunny_id = models.CharField(max_length=100, blank=True)
    video_timing = models.CharField(
        max_length=10, choices=VideoTiming.choices, default=VideoTiming.AFTER
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class HomeworkQuestion(QuestionBase):
    """MCQ homework attached to a lesson, group-scoped."""

    class Meta:
        ordering = ["lesson", "id"]

    def __str__(self):
        return f"Homework Q{self.id} - {self.lesson.title}"


class CollectionQuestion(QuestionBase):
    """
    بنك التجميعات — يظهر لكل طلاب المادة (ليس مقيداً بمجموعة المدرس).
    المحاكي واختبار المدرس يسحبان من هذه الأسئلة مع فلتر difficulty.
    """

    written_correction = models.TextField(blank=True)
    # free_order 1..N marks a question as part of the free preview (first 10).
    free_order = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["lesson", "difficulty", "id"]

    def __str__(self):
        return f"Bank Q{self.id} - {self.lesson.title} [{self.difficulty}]"


class Exam(models.Model):
    """A student's test attempt (simulator or teacher test)."""

    class Type(models.TextChoices):
        SIMULATOR = "simulator", "المحاكي الشخصي"
        TEACHER = "teacher", "اختبار المدرس"

    class Preset(models.TextChoices):
        EASY = "easy", "سهل"
        MEDIUM = "medium", "متوسط"
        HARD = "hard", "صعب"

    class ReviewMode(models.TextChoices):
        IMMEDIATE = "immediate", "فورية"
        FINAL = "final", "نهائية"

    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "قيد التنفيذ"
        FINISHED = "finished", "منتهي"
        AUTO_SUBMITTED = "auto_submitted", "إرسال تلقائي"

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="exams", on_delete=models.CASCADE
    )
    group = models.ForeignKey(
        "groups.StudyGroup",
        related_name="exams",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    subject = models.ForeignKey(
        "catalog.Subject", related_name="exams", on_delete=models.CASCADE
    )
    exam_type = models.CharField(max_length=12, choices=Type.choices)
    difficulty_preset = models.CharField(
        max_length=10, choices=Preset.choices, blank=True
    )
    review_mode = models.CharField(
        max_length=10, choices=ReviewMode.choices, default=ReviewMode.FINAL
    )
    question_count = models.PositiveIntegerField(default=0)
    title_override = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Custom name e.g. named teacher test",
    )
    teacher_test = models.ForeignKey(
        "TeacherTest",
        related_name="attempts",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    is_free_attempt = models.BooleanField(
        default=False, help_text="Capped free-tier attempt (max 10 questions)"
    )
    # null / 0 = unlimited time; otherwise countdown from started_at
    time_limit_minutes = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=15, choices=Status.choices, default=Status.IN_PROGRESS
    )
    score_percent = models.FloatField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.get_exam_type_display()} - {self.student.full_name}"

    @property
    def ends_at(self):
        if not self.time_limit_minutes:
            return None
        from datetime import timedelta

        return self.started_at + timedelta(minutes=self.time_limit_minutes)

    @property
    def title(self):
        if self.title_override:
            return self.title_override
        if self.teacher_test_id:
            name = (
                TeacherTest.objects.filter(id=self.teacher_test_id)
                .values_list("name", flat=True)
                .first()
            )
            if name:
                return name
        return f"{self.get_exam_type_display()} — {self.subject.name}"


class TeacherTest(models.Model):
    """Named test composed by a teacher from collection (تجميعات) questions."""

    name = models.CharField(max_length=200)
    subject = models.ForeignKey(
        "catalog.Subject", related_name="teacher_tests", on_delete=models.CASCADE
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="teacher_tests",
        on_delete=models.SET_NULL,
        null=True,
    )
    review_mode = models.CharField(
        max_length=10,
        choices=Exam.ReviewMode.choices,
        default=Exam.ReviewMode.FINAL,
    )
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    @property
    def question_count(self):
        return self.items.count()


class TeacherTestLesson(models.Model):
    teacher_test = models.ForeignKey(
        TeacherTest, related_name="lesson_links", on_delete=models.CASCADE
    )
    lesson = models.ForeignKey("catalog.Lesson", on_delete=models.CASCADE)

    class Meta:
        unique_together = ("teacher_test", "lesson")


class TeacherTestQuestion(models.Model):
    teacher_test = models.ForeignKey(
        TeacherTest, related_name="items", on_delete=models.CASCADE
    )
    question = models.ForeignKey(CollectionQuestion, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        unique_together = ("teacher_test", "question")


class ExamLesson(models.Model):
    exam = models.ForeignKey(Exam, related_name="lessons", on_delete=models.CASCADE)
    lesson = models.ForeignKey("catalog.Lesson", on_delete=models.CASCADE)

    class Meta:
        unique_together = ("exam", "lesson")


class ExamAnswer(models.Model):
    exam = models.ForeignKey(Exam, related_name="answers", on_delete=models.CASCADE)
    question = models.ForeignKey(CollectionQuestion, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    selected_answer = models.CharField(max_length=10, blank=True)
    is_correct = models.BooleanField(default=False)
    skipped = models.BooleanField(default=False)
    answered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["exam", "order"]
        unique_together = ("exam", "question")
