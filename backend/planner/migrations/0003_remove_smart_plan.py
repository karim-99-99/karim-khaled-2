from django.db import migrations


class Migration(migrations.Migration):
    """Drop the removed planner tables. Backup the database before production."""

    dependencies = [
        ("planner", "0002_schedule_mode_dates"),
    ]

    operations = [
        migrations.DeleteModel(name="StudyPlanTask"),
        migrations.DeleteModel(name="StudyPlan"),
    ]
