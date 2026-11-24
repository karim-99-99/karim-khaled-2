from django.db import migrations


class Migration(migrations.Migration):
    """Drop الجدول الذكي tables (brief: Global — Remove). Backup DB before production."""

    dependencies = [
        ("planner", "0002_schedule_mode_dates"),
    ]

    operations = [
        migrations.DeleteModel(name="StudyPlanTask"),
        migrations.DeleteModel(name="StudyPlan"),
    ]
