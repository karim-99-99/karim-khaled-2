import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0005_subject_theme_key"),
        ("scheduling", "0007_session_type_title_override"),
    ]

    operations = [
        migrations.AddField(
            model_name="session",
            name="lesson",
            field=models.ForeignKey(
                blank=True,
                help_text="اختياري — ربط عرضي بحصة التأسيس التي تكمّلها الإضافية",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sessions",
                to="catalog.lesson",
            ),
        ),
    ]
