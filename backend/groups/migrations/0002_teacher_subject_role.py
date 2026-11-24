import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("groups", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="TeacherSubjectRole",
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
                    "role",
                    models.CharField(
                        choices=[
                            ("main", "مدرس أساسي"),
                            ("secondary", "مدرس ثانوي"),
                        ],
                        default="secondary",
                        max_length=20,
                    ),
                ),
                (
                    "subject",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="teacher_roles",
                        to="catalog.subject",
                    ),
                ),
                (
                    "teacher",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="subject_roles",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "unique_together": {("teacher", "subject")},
            },
        ),
        migrations.AddConstraint(
            model_name="teachersubjectrole",
            constraint=models.UniqueConstraint(
                condition=models.Q(("role", "main")),
                fields=("subject",),
                name="uniq_main_teacher_per_subject",
            ),
        ),
    ]
