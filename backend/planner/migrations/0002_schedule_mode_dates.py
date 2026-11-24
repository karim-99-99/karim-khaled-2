from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("planner", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="studyplan",
            name="end_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="studyplan",
            name="schedule_mode",
            field=models.CharField(
                choices=[
                    ("sequential", "مادة بعد مادة"),
                    ("weekly", "مادة كل أسبوع"),
                ],
                default="sequential",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="studyplan",
            name="weekly_off",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="studyplan",
            name="custom_off",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
