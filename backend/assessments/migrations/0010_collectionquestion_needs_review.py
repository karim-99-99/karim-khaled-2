from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0009_video_url_length"),
    ]

    operations = [
        migrations.AddField(
            model_name="collectionquestion",
            name="needs_review",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="collectionquestion",
            name="review_notes",
            field=models.TextField(blank=True, default=""),
        ),
    ]
