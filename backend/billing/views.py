from datetime import timedelta

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import AdminAuditLog
from core.permissions import IsAdmin
from .models import Payment, Subscription
from .serializers import PaymentSerializer, SubscriptionSerializer

PLAN_DAYS = {"monthly": 30, "quarterly": 90, "yearly": 365}


def _activate(student, plan, method="card", reference="", amount=0):
    """Create/extend a subscription and log a successful payment."""
    today = timezone.now().date()
    current = student.subscriptions.filter(end_date__gte=today).order_by("-end_date").first()
    start = current.end_date if current else today
    end = start + timedelta(days=PLAN_DAYS.get(plan, 30))
    sub = Subscription.objects.create(
        student=student, plan=plan, start_date=today, end_date=end
    )
    Payment.objects.create(
        subscription=sub,
        student=student,
        plan=plan,
        method=method,
        amount=amount,
        status=Payment.Status.SUCCESS,
        gateway_reference=reference,
        paid_at=timezone.now(),
    )
    return sub


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_subscription(request):
    today = timezone.now().date()
    sub = (
        request.user.subscriptions.filter(end_date__gte=today)
        .order_by("-end_date")
        .first()
    )
    if not sub:
        return Response({"active": False, "subscription": None})
    return Response({"active": True, "subscription": SubscriptionSerializer(sub).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def checkout(request):
    """
    Provider-agnostic checkout. In dev (no gateway configured) this activates
    immediately. Wire a real gateway + webhook here later.
    """
    plan = request.data.get("plan", "monthly")
    method = request.data.get("method", "card")
    if plan not in PLAN_DAYS:
        return Response({"detail": "باقة غير صحيحة"}, status=status.HTTP_400_BAD_REQUEST)
    sub = _activate(request.user, plan, method=method, reference="DEV-AUTO")
    return Response(
        {
            "status": "activated",
            "note": "تم التفعيل تلقائياً (وضع التطوير). اربط بوابة الدفع لاحقاً.",
            "subscription": SubscriptionSerializer(sub).data,
        },
        status=201,
    )


@api_view(["POST"])
@permission_classes([IsAdmin])
def admin_grant_subscription(request, user_id):
    """
    Admin activates a student's account for a custom duration (in days). Extends
    any current subscription and enables login if it was pending.
    """
    from accounts.models import User

    student = User.objects.filter(id=user_id, role=User.Role.STUDENT).first()
    if not student:
        return Response({"detail": "الطالب غير موجود"}, status=status.HTTP_404_NOT_FOUND)

    try:
        days = int(request.data.get("days", 30))
    except (TypeError, ValueError):
        days = 30
    if days <= 0:
        return Response({"detail": "مدة غير صحيحة"}, status=status.HTTP_400_BAD_REQUEST)

    # Label the plan by duration.
    if days <= 45:
        plan = Subscription.Plan.MONTHLY
    elif days <= 135:
        plan = Subscription.Plan.QUARTERLY
    else:
        plan = Subscription.Plan.YEARLY

    today = timezone.now().date()
    current = (
        student.subscriptions.filter(end_date__gte=today).order_by("-end_date").first()
    )
    start = current.end_date if current else today
    end = start + timedelta(days=days)
    sub = Subscription.objects.create(
        student=student, plan=plan, start_date=today, end_date=end
    )
    Payment.objects.create(
        subscription=sub,
        student=student,
        plan=plan,
        method=Payment.Method.MANUAL,
        amount=0,
        status=Payment.Status.SUCCESS,
        gateway_reference="ADMIN-GRANT",
        paid_at=timezone.now(),
    )
    if not student.is_active:
        student.is_active = True
        student.save(update_fields=["is_active"])
    AdminAuditLog.objects.create(
        actor=request.user,
        action="grant_subscription",
        detail={"student": student.id, "days": days, "end": str(end)},
    )
    return Response(
        {"status": "granted", "subscription": SubscriptionSerializer(sub).data},
        status=201,
    )


class AdminSubscriptionViewSet(viewsets.ModelViewSet):
    queryset = Subscription.objects.select_related("student").all()
    serializer_class = SubscriptionSerializer
    permission_classes = [IsAdmin]

    def perform_create(self, serializer):
        sub = serializer.save()
        AdminAuditLog.objects.create(
            actor=self.request.user,
            action="manual_activate_subscription",
            detail={"student": sub.student_id, "plan": sub.plan},
        )


class AdminPaymentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Payment.objects.select_related("student").all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAdmin]
