import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0004_video_url_length"),
        ("assessments", "0012_collectionquestion_teacher_tier"),
    ]

    operations = [
        migrations.CreateModel(
            name="CollectionSubLesson",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("order_number", models.PositiveIntegerField(default=1)),
                ("title", models.CharField(max_length=200)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "lesson",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="collection_sub_lessons",
                        to="catalog.lesson",
                    ),
                ),
            ],
            options={"ordering": ["lesson", "order_number", "id"]},
        ),
        migrations.AddField(
            model_name="collectionquestion",
            name="sub_lesson",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="questions",
                to="assessments.collectionsublesson",
            ),
        ),
    ]
