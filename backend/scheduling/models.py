from django.conf import settings
from django.db import models


class Session(models.Model):
    """A live Zoom class session."""

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "مجدولة"
        LIVE = "live", "مباشر الآن"
        DONE = "done", "منتهية"

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
        return f"{self.subject.name} @ {self.start_time:%Y-%m-%d %H:%M}"
