from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scheduling", "0003_sessionattendance"),
    ]

    operations = [
        migrations.AddField(
            model_name="session",
            name="teacher_joined_zoom",
            field=models.BooleanField(
                default=False,
                help_text="هل سجّل المدرس دخوله إلى Zoom لهذه الحصة",
            ),
        ),
        migrations.AddField(
            model_name="session",
            name="teacher_joined_zoom_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
