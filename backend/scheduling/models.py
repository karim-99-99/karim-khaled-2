from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


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

    @property
    def end_time(self):
        mins = self.duration_minutes or 60
        return self.start_time + timedelta(minutes=mins)

    def compute_status(self, now=None):
        """Derive status from the clock so «مباشر» cannot stick after the session ends."""
        now = now or timezone.now()
        if self.status == self.Status.DONE:
            return self.Status.DONE
        if now < self.start_time:
            return self.Status.SCHEDULED
        if now <= self.end_time:
            return self.Status.LIVE
        return self.Status.DONE


def sync_session_statuses(queryset=None):
    """
    Persist time-based status for sessions that are still open.
    Marks ended sessions as done; marks in-progress ones as live.
    """
    now = timezone.now()
    qs = queryset if queryset is not None else Session.objects.all()
    rows = qs.exclude(status=Session.Status.DONE).only(
        "id", "start_time", "duration_minutes", "status"
    )
    done_ids = []
    live_ids = []
    scheduled_ids = []
    for s in rows:
        computed = s.compute_status(now)
        if computed == s.status:
            continue
        if computed == Session.Status.DONE:
            done_ids.append(s.id)
        elif computed == Session.Status.LIVE:
            live_ids.append(s.id)
        elif computed == Session.Status.SCHEDULED:
            scheduled_ids.append(s.id)
    if done_ids:
        Session.objects.filter(id__in=done_ids).update(status=Session.Status.DONE)
    if live_ids:
        Session.objects.filter(id__in=live_ids).update(status=Session.Status.LIVE)
    if scheduled_ids:
        Session.objects.filter(id__in=scheduled_ids).update(
            status=Session.Status.SCHEDULED
        )


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
