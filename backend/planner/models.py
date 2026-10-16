from django.conf import settings
from django.db import models


class StudyPlan(models.Model):
    """خطة مذاكرة ذكية مخصّصة لطالب حسب مدته وساعاته اليومية."""

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="study_plans",
        on_delete=models.CASCADE,
    )
    title = models.CharField(max_length=200, blank=True, default="")
    start_date = models.DateField()
    days_count = models.PositiveIntegerField()
    hours_per_day = models.DecimalField(max_digits=4, decimal_places=1, default=2)
    include_foundation = models.BooleanField(default=True)
    include_collections = models.BooleanField(default=True)
    subject_ids = models.JSONField(default=list)
    exam_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"Plan {self.id} · {self.student_id} · {self.days_count}d"


class StudyPlanTask(models.Model):
    """مهمة يومية داخل الخطة (تأسيس / تجميع / مراجعة)."""

    class Kind(models.TextChoices):
        FOUNDATION = "foundation", "تأسيس"
        COLLECTIONS = "collections", "تجميع"
        REVIEW = "review", "مراجعة"

    plan = models.ForeignKey(StudyPlan, related_name="tasks", on_delete=models.CASCADE)
    day_index = models.PositiveIntegerField(help_text="1..days_count")
    task_date = models.DateField()
    kind = models.CharField(max_length=20, choices=Kind.choices)
    subject = models.ForeignKey(
        "catalog.Subject",
        related_name="study_plan_tasks",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    lesson = models.ForeignKey(
        "catalog.Lesson",
        related_name="study_plan_tasks",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=300)
    detail = models.TextField(blank=True, default="")
    estimated_minutes = models.PositiveIntegerField(default=60)
    order_on_day = models.PositiveIntegerField(default=1)
    is_done = models.BooleanField(default=False)
    done_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["day_index", "order_on_day", "id"]

    def __str__(self):
        return f"D{self.day_index} · {self.title}"
