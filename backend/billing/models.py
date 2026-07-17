from django.conf import settings
from django.db import models
from django.utils import timezone


class Subscription(models.Model):
    class Plan(models.TextChoices):
        MONTHLY = "monthly", "شهري"
        QUARTERLY = "quarterly", "فصلي"
        YEARLY = "yearly", "سنوي"

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="subscriptions",
        on_delete=models.CASCADE,
    )
    plan = models.CharField(max_length=10, choices=Plan.choices)
    start_date = models.DateField(default=timezone.now)
    end_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-end_date"]

    def __str__(self):
        return f"{self.student.full_name} - {self.get_plan_display()}"

    @property
    def is_active(self):
        return self.end_date >= timezone.now().date()

    @property
    def days_remaining(self):
        return max((self.end_date - timezone.now().date()).days, 0)


class Payment(models.Model):
    class Method(models.TextChoices):
        CARD = "card", "بطاقة بنكية"
        VODAFONE_CASH = "vodafone_cash", "فودافون كاش"
        WALLET = "wallet", "محفظة إلكترونية"
        MANUAL = "manual", "تفعيل إداري"

    class Status(models.TextChoices):
        PENDING = "pending", "قيد الانتظار"
        SUCCESS = "success", "ناجحة"
        FAILED = "failed", "فاشلة"

    subscription = models.ForeignKey(
        Subscription,
        related_name="payments",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="payments", on_delete=models.CASCADE
    )
    plan = models.CharField(max_length=10, choices=Subscription.Plan.choices)
    method = models.CharField(max_length=15, choices=Method.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    gateway_reference = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.student.full_name} - {self.get_method_display()} - {self.status}"
