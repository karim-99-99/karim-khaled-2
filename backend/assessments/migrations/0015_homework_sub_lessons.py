import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0005_subject_theme_key"),
        ("assessments", "0014_question_order_number"),
    ]

    operations = [
        migrations.CreateModel(
            name="HomeworkSubLesson",
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
                ("order_number", models.PositiveIntegerField(default=1)),
                ("title", models.CharField(max_length=200)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "lesson",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="homework_sub_lessons",
                        to="catalog.lesson",
                    ),
                ),
            ],
            options={
                "ordering": ["lesson", "order_number", "id"],
            },
        ),
        migrations.AddField(
            model_name="homeworkquestion",
            name="homework_sub_lesson",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="questions",
                to="assessments.homeworksublesson",
            ),
        ),
        migrations.AlterModelOptions(
            name="homeworkquestion",
            options={
                "ordering": [
                    "lesson",
                    "homework_sub_lesson",
                    "section",
                    "order_number",
                    "id",
                ]
            },
        ),
    ]
