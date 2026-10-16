import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("catalog", "0004_video_url_length"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="StudyPlan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(blank=True, default="", max_length=200)),
                ("start_date", models.DateField()),
                ("days_count", models.PositiveIntegerField()),
                ("hours_per_day", models.DecimalField(decimal_places=1, default=2, max_digits=4)),
                ("include_foundation", models.BooleanField(default=True)),
                ("include_collections", models.BooleanField(default=True)),
                ("subject_ids", models.JSONField(default=list)),
                ("exam_date", models.DateField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="study_plans",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.CreateModel(
            name="StudyPlanTask",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("day_index", models.PositiveIntegerField(help_text="1..days_count")),
                ("task_date", models.DateField()),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("foundation", "تأسيس"),
                            ("collections", "تجميع"),
                            ("review", "مراجعة"),
                        ],
                        max_length=20,
                    ),
                ),
                ("title", models.CharField(max_length=300)),
                ("detail", models.TextField(blank=True, default="")),
                ("estimated_minutes", models.PositiveIntegerField(default=60)),
                ("order_on_day", models.PositiveIntegerField(default=1)),
                ("is_done", models.BooleanField(default=False)),
                ("done_at", models.DateTimeField(blank=True, null=True)),
                (
                    "lesson",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="study_plan_tasks",
                        to="catalog.lesson",
                    ),
                ),
                (
                    "plan",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tasks",
                        to="planner.studyplan",
                    ),
                ),
                (
                    "subject",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="study_plan_tasks",
                        to="catalog.subject",
                    ),
                ),
            ],
            options={"ordering": ["day_index", "order_on_day", "id"]},
        ),
    ]
