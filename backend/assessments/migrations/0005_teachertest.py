# Generated manually for TeacherTest + Exam title_override

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("catalog", "0001_initial"),
        ("assessments", "0004_question_images_explanation"),
    ]

    operations = [
        migrations.CreateModel(
            name="TeacherTest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                (
                    "review_mode",
                    models.CharField(
                        choices=[("immediate", "فورية"), ("final", "نهائية")],
                        default="final",
                        max_length=10,
                    ),
                ),
                ("is_published", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="teacher_tests",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "subject",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="teacher_tests",
                        to="catalog.subject",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="TeacherTestLesson",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "lesson",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="catalog.lesson"),
                ),
                (
                    "teacher_test",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lesson_links",
                        to="assessments.teachertest",
                    ),
                ),
            ],
            options={"unique_together": {("teacher_test", "lesson")}},
        ),
        migrations.CreateModel(
            name="TeacherTestQuestion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order", models.PositiveIntegerField(default=0)),
                (
                    "question",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="assessments.collectionquestion",
                    ),
                ),
                (
                    "teacher_test",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="assessments.teachertest",
                    ),
                ),
            ],
            options={
                "ordering": ["order", "id"],
                "unique_together": {("teacher_test", "question")},
            },
        ),
        migrations.AddField(
            model_name="exam",
            name="title_override",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Custom name e.g. named teacher test",
                max_length=200,
            ),
        ),
        migrations.AddField(
            model_name="exam",
            name="teacher_test",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="attempts",
                to="assessments.teachertest",
            ),
        ),
    ]
