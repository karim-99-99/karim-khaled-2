from django.db import migrations, models


def assign_theme_keys(apps, schema_editor):
    Subject = apps.get_model("catalog", "Subject")
    from catalog.themes import theme_key_for

    for subject in Subject.objects.all():
        key = theme_key_for(subject.slug, subject.name)
        if subject.theme_key != key:
            subject.theme_key = key
            subject.save(update_fields=["theme_key"])


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0004_video_url_length"),
    ]

    operations = [
        migrations.AddField(
            model_name="subject",
            name="theme_key",
            field=models.CharField(
                blank=True,
                default="",
                help_text="math, physics, chem, or bio. Empty uses the brand blue.",
                max_length=20,
            ),
        ),
        migrations.RunPython(assign_theme_keys, migrations.RunPython.noop),
    ]
