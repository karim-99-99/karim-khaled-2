from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0018_exam_collection_sections"),
    ]

    operations = [
        migrations.AddField(
            model_name="exam",
            name="break_pending",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="exam",
            name="break_started_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="exam",
            name="current_section",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
