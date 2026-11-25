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
    # Homework (تأسيس): group is always null — global library under the lesson
    # (HomeworkSubLesson titles). Collection (تجميعات): group is always null.
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

    # Every question (homework + collection) has a difficulty.
    # Shown to students on collection/exam questions alongside subject & lesson.
    difficulty = models.CharField(
        max_length=10, choices=Difficulty.choices, default=Difficulty.MEDIUM
    )

    # Bunny GUID or any external video URL (YouTube / Drive / cloud).
    video_bunny_id = models.CharField(max_length=500, blank=True)
    video_timing = models.CharField(
        max_length=10, choices=VideoTiming.choices, default=VideoTiming.AFTER
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class HomeworkSubLesson(models.Model):
    """
    عنوان واجب فرعي تحت درس تأسيس (مكتبة عامة — مثل CollectionSubLesson).
    منفصل عن LessonSection (فيديو/PDF).
    """

    lesson = models.ForeignKey(
        "catalog.Lesson",
        related_name="homework_sub_lessons",
        on_delete=models.CASCADE,
    )
    order_number = models.PositiveIntegerField(default=1)
    title = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["lesson", "order_number", "id"]

    def __str__(self):
        return f"{self.lesson.title} › واجب: {self.title}"


class HomeworkQuestion(QuestionBase):
    """واجب تأسيس — مكتبة عامة تحت عنوان فرعي (أو الدرس مباشرة)."""

    # Legacy: video subsection. Prefer homework_sub_lesson (Task 16).
    section = models.ForeignKey(
        "catalog.LessonSection",
        related_name="homework_questions",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    homework_sub_lesson = models.ForeignKey(
        HomeworkSubLesson,
        related_name="questions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    # ترتيب يدوي داخل العنوان الفرعي (أو الدرس إن لم يُحدد قسم).
    order_number = models.PositiveIntegerField(default=1)
    needs_review = models.BooleanField(default=False)
    review_notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["lesson", "homework_sub_lesson", "section", "order_number", "id"]

    def __str__(self):
        return f"Homework Q{self.id} - {self.lesson.title}"


class CollectionSubLesson(models.Model):
    """
    درس فرعي اختياري داخل درس تجميعات رئيسي.
    الأسئلة إمّا مباشرة تحت الدرس الرئيسي (sub_lesson فارغ) أو داخل درس فرعي.
    منفصل عن LessonSection لأن دروس التأسيس والتجميعات تتشارك نفس Lesson.
    """

    lesson = models.ForeignKey(
        "catalog.Lesson",
        related_name="collection_sub_lessons",
        on_delete=models.CASCADE,
    )
    order_number = models.PositiveIntegerField(default=1)
    title = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["lesson", "order_number", "id"]

    def __str__(self):
        return f"{self.lesson.title} › {self.title}"


class CollectionQuestion(QuestionBase):
    """
    بنك التجميعات — يظهر لكل طلاب المادة (ليس مقيداً بمجموعة المدرس).
    المحاكي واختبار المدرس يسحبان من هذه الأسئلة مع فلتر difficulty.
    """

    # Deleting a sub-lesson keeps its questions under the main lesson.
    sub_lesson = models.ForeignKey(
        CollectionSubLesson,
        related_name="questions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    written_correction = models.TextField(blank=True)
    # Optional year label (e.g. 1445 or 2024) — shown to students when set.
    question_year = models.CharField(max_length=20, blank=True, default="")
    # Imported questions with missing/uncertain data stay hidden from students
    # until the teacher reviews and approves them (needs_review=False).
    needs_review = models.BooleanField(default=False)
    # Human-readable reasons filled by the file importer (for the review UI).
    review_notes = models.TextField(blank=True, default="")
    # free_order 1..N marks a question as part of the free preview (first 10).
    free_order = models.PositiveIntegerField(null=True, blank=True)
    # ترتيب يدوي داخل الدرس / الدرس الفرعي (مستقل عن مستوى الصعوبة).
    order_number = models.PositiveIntegerField(default=1)
    # Teacher recommendation tier for collections (student filter).
    class TeacherTier(models.TextChoices):
        GOLD = "gold", "ذهبي"
        SILVER = "silver", "فضي"
        BRONZE = "bronze", "برونزي"

    teacher_tier = models.CharField(
        max_length=10, choices=TeacherTier.choices, blank=True, default=""
    )

    class Meta:
        ordering = ["lesson", "sub_lesson", "order_number", "id"]

    def __str__(self):
        return f"Bank Q{self.id} - {self.lesson.title} [{self.difficulty}]"


class LessonCollectionLink(models.Model):
    """
    ربط درس تأسيس (أو حصة إضافية) بتجميعة — صفحة المهام عند المدرس (Task 17).

    - group=NULL → الافتراضي لكل المجموعات.
    - group محدد → تخصيص لتلك المجموعة فقط (يستبدل الافتراضي عند العرض).
    - collection_sub_lesson=NULL → تجميعة رئيسية كاملة (كل الفرعيات).
    - extra_session → حصة إضافية (بدل lesson).
    """

    lesson = models.ForeignKey(
        "catalog.Lesson",
        related_name="task_collection_links",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    extra_session = models.ForeignKey(
        "scheduling.Session",
        related_name="task_collection_links",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    collection_lesson = models.ForeignKey(
        "catalog.Lesson",
        related_name="linked_as_collection_tasks",
        on_delete=models.CASCADE,
    )
    collection_sub_lesson = models.ForeignKey(
        CollectionSubLesson,
        related_name="task_links",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    group = models.ForeignKey(
        "groups.StudyGroup",
        related_name="task_collection_links",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    order_number = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order_number", "id"]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(lesson__isnull=False, extra_session__isnull=True)
                    | models.Q(lesson__isnull=True, extra_session__isnull=False)
                ),
                name="task_link_lesson_xor_extra",
            ),
        ]

    def __str__(self):
        target = (
            f"extra#{self.extra_session_id}"
            if self.extra_session_id
            else f"lesson#{self.lesson_id}"
        )
        node = (
            f"sub#{self.collection_sub_lesson_id}"
            if self.collection_sub_lesson_id
            else f"main#{self.collection_lesson_id}"
        )
        return f"TaskLink {target} → {node} g={self.group_id}"


class StudentPracticeAnswer(models.Model):
    """
    Per-question practice answers for daily tasks (Task 20).
    A homework/collection task is «تم» only when EVERY question has a row here.
    """

    class Kind(models.TextChoices):
        HOMEWORK = "homework", "واجب"
        COLLECTION = "collection", "تجميعة"

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="practice_answers",
        on_delete=models.CASCADE,
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    question_id = models.PositiveIntegerField()
    selected_answer = models.CharField(max_length=10)
    is_correct = models.BooleanField(default=False)
    answered_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-answered_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "kind", "question_id"],
                name="uniq_student_practice_answer",
            )
        ]

    def __str__(self):
        return f"{self.student_id} {self.kind}#{self.question_id}"


class Exam(models.Model):
    """A student's test attempt (simulator or teacher test)."""

    class Type(models.TextChoices):
        SIMULATOR = "simulator", "المحاكي الشخصي"
        TEACHER = "teacher", "اختبار المدرس"
        COLLECTION = "collection", "تجميعات"

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
    # Absolute 0-based index of the last question the student was on (resume — Task 21).
    last_question_index = models.PositiveIntegerField(default=0)
    # Simulator sections of 22 (Task 22): active section index; prior sections locked.
    current_section = models.PositiveIntegerField(default=0)
    # True while the 5-minute break screen is showing after finishing a section.
    break_pending = models.BooleanField(default=False)
    break_started_at = models.DateTimeField(null=True, blank=True)

    # Break duration between simulator sections (seconds).
    SECTION_BREAK_SECONDS = 5 * 60

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.get_exam_type_display()} - {self.student.full_name}"

    @property
    def section_size(self) -> int | None:
        """Collections = 50; simulators = 22; teacher tests = no sections."""
        if self.exam_type == self.Type.COLLECTION:
            return 50
        if self.exam_type == self.Type.SIMULATOR:
            return 22
        return None

    @property
    def sections_locked(self) -> bool:
        """Finished sections are locked only for simulators (not collections / teacher)."""
        return self.exam_type == self.Type.SIMULATOR and self.section_size is not None

    def section_count(self) -> int:
        size = self.section_size
        if not size or self.question_count < 1:
            return 0
        return (self.question_count + size - 1) // size

    def section_index_for_order(self, order: int) -> int | None:
        size = self.section_size
        if not size:
            return None
        return int(order) // size

    def section_range(self, section_index: int) -> tuple[int, int] | None:
        """Inclusive start/end question orders for a section."""
        size = self.section_size
        if not size or section_index < 0:
            return None
        start = section_index * size
        if start >= self.question_count:
            return None
        end = min(start + size, self.question_count) - 1
        return start, end

    def resolve_break_on_load(self) -> bool:
        """
        Leaving during a break skips the wait — resume at the next section (6.5).
        A short grace (~3s) keeps the break alive across same-page remounts
        (e.g. React Strict Mode) so only a real leave/return advances.
        """
        if not self.break_pending or self.status != self.Status.IN_PROGRESS:
            return False
        from django.utils import timezone as dj_tz

        if self.break_started_at:
            age = (dj_tz.now() - self.break_started_at).total_seconds()
            if age < 3:
                return False
        return self.advance_from_break()

    def start_section_break(self) -> bool:
        """Enter break after finishing the current simulator section."""
        if not self.sections_locked:
            return False
        if self.break_pending:
            return True
        if self.current_section >= max(0, self.section_count() - 1):
            return False
        from django.utils import timezone as dj_tz

        self.break_pending = True
        self.break_started_at = dj_tz.now()
        self.save(update_fields=["break_pending", "break_started_at"])
        return True

    def advance_from_break(self) -> bool:
        """End break and unlock the next section."""
        if not self.sections_locked:
            self.break_pending = False
            self.break_started_at = None
            self.save(update_fields=["break_pending", "break_started_at"])
            return False
        max_sec = max(0, self.section_count() - 1)
        nxt = min(self.current_section + 1, max_sec)
        size = self.section_size or 1
        self.current_section = nxt
        self.last_question_index = nxt * size
        self.break_pending = False
        self.break_started_at = None
        self.save(
            update_fields=[
                "current_section",
                "last_question_index",
                "break_pending",
                "break_started_at",
            ]
        )
        return True

    def order_is_answerable(self, order: int) -> bool:
        """API lock: simulator may only answer inside the current unlocked section."""
        if self.break_pending:
            return False
        if not self.sections_locked:
            return True
        sec = self.section_index_for_order(order)
        return sec is not None and sec == self.current_section

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
    # Task 31 — teacher-test window & duration (no 22-section split)
    class DurationMode(models.TextChoices):
        WHOLE = "whole", "مدة الاختبار كامل"
        PER_QUESTION = "per_question", "وقت لكل سؤال"

    opens_at = models.DateTimeField(null=True, blank=True)
    closes_at = models.DateTimeField(null=True, blank=True)
    duration_mode = models.CharField(
        max_length=20,
        choices=DurationMode.choices,
        default=DurationMode.WHOLE,
    )
    # whole → minutes; per_question → seconds
    duration_value = models.PositiveIntegerField(default=60)
    groups = models.ManyToManyField(
        "groups.StudyGroup",
        related_name="teacher_tests",
        blank=True,
    )
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
