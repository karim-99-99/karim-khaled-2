from django.conf import settings
from django.db import models


class Session(models.Model):
    """A live Zoom class session."""

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "مجدولة"
        LIVE = "live", "مباشر الآن"
        DONE = "done", "منتهية"

    title = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="اسم اختياري للحصة (مثال: مراجعة الباب الأول)",
    )
    subject = models.ForeignKey(
        "catalog.Subject", related_name="sessions", on_delete=models.CASCADE
    )
    group = models.ForeignKey(
        "groups.StudyGroup",
        related_name="sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    teacher_name = models.CharField(max_length=120, blank=True)
    start_time = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=60)
    zoom_link = models.URLField(blank=True)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.SCHEDULED
    )

    class Meta:
        ordering = ["start_time"]

    def __str__(self):
        label = self.title or self.subject.name
        return f"{label} @ {self.start_time:%Y-%m-%d %H:%M}"

    @property
    def display_title(self):
        return (self.title or "").strip() or self.subject.name


class SessionAttendance(models.Model):
    """Present / absent mark for a student in a live session."""

    class Status(models.TextChoices):
        PRESENT = "present", "حاضر"
        ABSENT = "absent", "غائب"

    session = models.ForeignKey(
        Session, related_name="attendances", on_delete=models.CASCADE
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="session_attendances",
        on_delete=models.CASCADE,
    )
    status = models.CharField(max_length=10, choices=Status.choices)
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="attendance_marks",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    marked_at = models.DateTimeField(auto_now=True)
    note = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        unique_together = ("session", "student")
        ordering = ["student__full_name", "student_id"]

    def __str__(self):
        return f"{self.student_id} @ session {self.session_id}: {self.status}"
