from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("scheduling", "0010_session_rated_at"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClassRating",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("draft", "مسودة"), ("saved", "محفوظ")],
                        default="draft",
                        max_length=10,
                    ),
                ),
                ("general_note", models.TextField(blank=True, default="")),
                ("saved_at", models.DateTimeField(blank=True, null=True)),
                (
                    "reports_sent_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="Last time parent Telegram reports were sent for this save",
                        null=True,
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "session",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="class_rating",
                        to="scheduling.session",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="class_ratings_updated",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="StudentClassRating",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("stars", models.PositiveSmallIntegerField(default=0)),
                ("tags", models.JSONField(blank=True, default=list)),
                ("note", models.TextField(blank=True, default="")),
                (
                    "class_rating",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="student_rows",
                        to="scheduling.classrating",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="class_ratings",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "unique_together": {("class_rating", "student")},
            },
        ),
    ]
