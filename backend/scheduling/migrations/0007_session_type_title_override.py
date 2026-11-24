from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scheduling", "0006_teacher_availability"),
    ]

    operations = [
        migrations.AddField(
            model_name="session",
            name="session_type",
            field=models.CharField(
                choices=[("foundation", "تأسيس"), ("extra", "حصة إضافية")],
                db_index=True,
                default="foundation",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="session",
            name="title_override",
            field=models.CharField(
                blank=True,
                default="",
                help_text="عنوان حر لحصص إضافية يكتبه المدير",
                max_length=200,
            ),
        ),
    ]
