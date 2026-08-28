from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0010_collectionquestion_needs_review"),
    ]

    operations = [
        migrations.AddField(
            model_name="homeworkquestion",
            name="needs_review",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="homeworkquestion",
            name="review_notes",
            field=models.TextField(blank=True, default=""),
        ),
    ]
