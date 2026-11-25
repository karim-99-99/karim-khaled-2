from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("groups", "0001_initial"),
        ("assessments", "0019_exam_simulator_sections"),
    ]

    operations = [
        migrations.AddField(
            model_name="teachertest",
            name="closes_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="teachertest",
            name="duration_mode",
            field=models.CharField(
                choices=[
                    ("whole", "مدة الاختبار كامل"),
                    ("per_question", "وقت لكل سؤال"),
                ],
                default="whole",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="teachertest",
            name="duration_value",
            field=models.PositiveIntegerField(default=60),
        ),
        migrations.AddField(
            model_name="teachertest",
            name="opens_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="teachertest",
            name="groups",
            field=models.ManyToManyField(
                blank=True, related_name="teacher_tests", to="groups.studygroup"
            ),
        ),
    ]
