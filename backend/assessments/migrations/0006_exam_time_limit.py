from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0005_teachertest"),
    ]

    operations = [
        migrations.AddField(
            model_name="exam",
            name="time_limit_minutes",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
