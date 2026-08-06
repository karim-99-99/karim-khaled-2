from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0002_lesson_created_by"),
    ]

    operations = [
        migrations.CreateModel(
            name="LessonSection",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order_number", models.PositiveIntegerField(default=1)),
                ("title", models.CharField(max_length=200)),
                ("bunny_video_id", models.CharField(blank=True, max_length=100)),
                ("pdf_url", models.URLField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "lesson",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sections",
                        to="catalog.lesson",
                    ),
                ),
            ],
            options={"ordering": ["lesson", "order_number", "id"]},
        ),
    ]
