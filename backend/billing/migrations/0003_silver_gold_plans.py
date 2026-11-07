from django.db import migrations, models


PLAN_CHOICES = [
    ("silver", "الباقة الفضية"),
    ("gold", "الباقة الذهبية"),
    ("monthly", "شهري"),
    ("quarterly", "فصلي"),
    ("yearly", "سنوي"),
]


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0002_alter_payment_method"),
    ]

    operations = [
        migrations.AlterField(
            model_name="subscription",
            name="plan",
            field=models.CharField(choices=PLAN_CHOICES, max_length=10),
        ),
        migrations.AlterField(
            model_name="payment",
            name="plan",
            field=models.CharField(choices=PLAN_CHOICES, max_length=10),
        ),
    ]
