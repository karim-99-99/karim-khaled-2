from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scheduling", "0009_sessionattendance_join_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="session",
            name="rated_at",
            field=models.DateTimeField(
                blank=True,
                help_text="متى حُفظ تقييم الحصة (مهمة 30 ستبني class_ratings)",
                null=True,
            ),
        ),
    ]
