import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0015_homework_sub_lessons"),
        ("catalog", "0005_subject_theme_key"),
        ("groups", "0002_teacher_subject_role"),
        ("scheduling", "0008_session_lesson"),
    ]

    operations = [
        migrations.CreateModel(
            name="LessonCollectionLink",
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
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "collection_lesson",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="linked_as_collection_tasks",
                        to="catalog.lesson",
                    ),
                ),
                (
                    "collection_sub_lesson",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="task_links",
                        to="assessments.collectionsublesson",
                    ),
                ),
                (
                    "extra_session",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="task_collection_links",
                        to="scheduling.session",
                    ),
                ),
                (
                    "group",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="task_collection_links",
                        to="groups.studygroup",
                    ),
                ),
                (
                    "lesson",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="task_collection_links",
                        to="catalog.lesson",
                    ),
                ),
            ],
            options={
                "ordering": ["order_number", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="lessoncollectionlink",
            constraint=models.CheckConstraint(
                check=models.Q(
                    ("extra_session__isnull", True), ("lesson__isnull", False)
                )
                | models.Q(
                    ("extra_session__isnull", False), ("lesson__isnull", True)
                ),
                name="task_link_lesson_xor_extra",
            ),
        ),
    ]
