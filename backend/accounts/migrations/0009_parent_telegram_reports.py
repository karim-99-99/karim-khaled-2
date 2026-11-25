from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0001_initial"),
        ("scheduling", "0010_session_rated_at"),
        ("accounts", "0008_student_profile_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="parent_link_code",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="يُستخدم في رابط تليجرام: /start {code}",
                max_length=24,
                null=True,
                unique=True,
                verbose_name="كود ربط ولي الأمر",
            ),
        ),
        migrations.CreateModel(
            name="ParentTelegramLink",
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
                ("chat_id", models.CharField(db_index=True, max_length=64)),
                ("telegram_username", models.CharField(blank=True, default="", max_length=150)),
                ("display_name", models.CharField(blank=True, default="", max_length=150)),
                ("linked_at", models.DateTimeField(auto_now_add=True)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="parent_telegram_links",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-linked_at"],
                "unique_together": {("student", "chat_id")},
            },
        ),
        migrations.CreateModel(
            name="ParentReport",
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
                    "report_type",
                    models.CharField(
                        choices=[
                            ("class", "تقرير حصة"),
                            ("reminder", "تذكير مهام"),
                        ],
                        default="class",
                        max_length=20,
                    ),
                ),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("content_text", models.TextField(blank=True, default="")),
                ("recipients", models.JSONField(blank=True, default=list)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("sent", "أُرسل"),
                            ("failed", "فشل"),
                            ("no_parent", "لا ولي أمر"),
                            ("queued", "بالانتظار"),
                        ],
                        default="queued",
                        max_length=20,
                    ),
                ),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="parent_reports_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "session",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="parent_reports",
                        to="scheduling.session",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="parent_reports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "subject",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="parent_reports",
                        to="catalog.subject",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
    ]
