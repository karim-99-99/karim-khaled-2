from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0017_student_practice_answers"),
    ]

    operations = [
        migrations.AddField(
            model_name="exam",
            name="last_question_index",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="exam",
            name="exam_type",
            field=models.CharField(
                choices=[
                    ("simulator", "المحاكي الشخصي"),
                    ("teacher", "اختبار المدرس"),
                    ("collection", "تجميعات"),
                ],
                max_length=12,
            ),
        ),
    ]
