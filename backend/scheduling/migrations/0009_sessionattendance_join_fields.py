from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scheduling", "0008_session_lesson"),
    ]

    operations = [
        migrations.AddField(
            model_name="sessionattendance",
            name="status_source",
            field=models.CharField(
                choices=[("auto", "تلقائي (دخول الحصة)"), ("teacher", "المدرس")],
                default="auto",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="sessionattendance",
            name="joined_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="sessionattendance",
            name="left_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="sessionattendance",
            name="duration_min",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
