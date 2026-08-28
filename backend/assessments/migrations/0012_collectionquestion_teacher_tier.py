from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0011_homeworkquestion_needs_review"),
    ]

    operations = [
        migrations.AddField(
            model_name="collectionquestion",
            name="teacher_tier",
            field=models.CharField(
                blank=True,
                choices=[("gold", "ذهبي"), ("silver", "فضي"), ("bronze", "برونزي")],
                default="",
                max_length=10,
            ),
        ),
    ]
