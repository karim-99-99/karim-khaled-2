from django.db import models


class Subject(models.Model):
    """A subject such as رياضيات. Fixed seed list, shared across all groups."""

    name = models.CharField(max_length=60, unique=True)
    slug = models.SlugField(max_length=60, unique=True)
    cover_gradient = models.CharField(
        max_length=120,
        blank=True,
        help_text="CSS gradient used on subject cards",
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.name


class Lesson(models.Model):
    """
    عنوان رئيسي في التأسيس أو التجميعات.
    في التأسيس فقط: تحته عناوين فرعية (LessonSection) فيها الفيديو والواجب وPDF.
    التجميعات تبقى على مستوى الدرس الرئيسي بدون عناوين فرعية.
    """

    subject = models.ForeignKey(
        Subject, related_name="lessons", on_delete=models.CASCADE
    )
    created_by = models.ForeignKey(
        "accounts.User",
        related_name="lessons_created",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    order_number = models.PositiveIntegerField(default=1)
    title = models.CharField(max_length=200)
    # Legacy fields — content moved to LessonSection for تأسيس.
    # Kept for older clients / collections lesson-level media if any.
    # Bunny Stream GUID, or any external video URL (YouTube / Drive / cloud).
    bunny_video_id = models.CharField(max_length=500, blank=True)
    pdf_url = models.URLField(blank=True)
    is_free_preview = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["subject", "order_number", "id"]

    def __str__(self):
        return f"{self.subject.name} - {self.order_number}. {self.title}"


class LessonSection(models.Model):
    """
    عنوان فرعي تحت درس التأسيس (مثل: السرعة، التسارع).
    يحتوي الفيديو وزر الواجب وPDF — التجميعات لا تستخدم هذا النموذج.
    """

    lesson = models.ForeignKey(
        Lesson, related_name="sections", on_delete=models.CASCADE
    )
    order_number = models.PositiveIntegerField(default=1)
    title = models.CharField(max_length=200)
    # Bunny Stream GUID, or any external video URL (YouTube / Drive / cloud).
    bunny_video_id = models.CharField(max_length=500, blank=True)
    pdf_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["lesson", "order_number", "id"]

    def __str__(self):
        return f"{self.lesson.title} › {self.title}"
