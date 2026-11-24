from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_telegram_oauth_consumed"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="region",
            field=models.CharField(
                blank=True, default="", max_length=80, verbose_name="المنطقة"
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="city",
            field=models.CharField(
                blank=True, default="", max_length=80, verbose_name="المدينة"
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="school_name",
            field=models.CharField(
                blank=True, default="", max_length=200, verbose_name="اسم المدرسة"
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="school_type",
            field=models.CharField(
                blank=True,
                choices=[("government", "حكومية"), ("private", "أهلية")],
                default="",
                max_length=20,
                verbose_name="نوع المدرسة",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="guardian_phone",
            field=models.CharField(
                blank=True, default="", max_length=20, verbose_name="جوال ولي الأمر"
            ),
        ),
    ]
