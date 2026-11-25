import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("assessments", "0016_lesson_collection_links"),
    ]

    operations = [
        migrations.CreateModel(
            name="StudentPracticeAnswer",
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
                    "kind",
                    models.CharField(
                        choices=[("homework", "واجب"), ("collection", "تجميعة")],
                        max_length=20,
                    ),
                ),
                ("question_id", models.PositiveIntegerField()),
                ("selected_answer", models.CharField(max_length=10)),
                ("is_correct", models.BooleanField(default=False)),
                ("answered_at", models.DateTimeField(auto_now=True)),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="practice_answers",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-answered_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="studentpracticeanswer",
            constraint=models.UniqueConstraint(
                fields=("student", "kind", "question_id"),
                name="uniq_student_practice_answer",
            ),
        ),
    ]
