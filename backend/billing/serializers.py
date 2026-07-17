from rest_framework import serializers

from .models import Payment, Subscription


class SubscriptionSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True)

    class Meta:
        model = Subscription
        fields = [
            "id",
            "student",
            "student_name",
            "plan",
            "start_date",
            "end_date",
            "is_active",
            "days_remaining",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "student",
            "student_name",
            "subscription",
            "plan",
            "method",
            "amount",
            "status",
            "gateway_reference",
            "created_at",
            "paid_at",
        ]
        read_only_fields = ["id", "created_at"]
