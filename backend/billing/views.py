from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.models import AdminAuditLog
from core.permissions import IsAdmin
from .models import Payment, Subscription
from .serializers import PaymentSerializer, SubscriptionSerializer

PLAN_LABELS = {"silver": "الباقة الفضية", "gold": "الباقة الذهبية"}
PLAN_LABELS_EN = {"silver": "Silver", "gold": "Gold"}
DEFAULT_PLAN_DAYS = {"silver": 365, "gold": 365}


def plan_days_map() -> dict:
    configured = getattr(settings, "SUBSCRIPTION_DAYS", None) or DEFAULT_PLAN_DAYS
    return {plan: int(configured.get(plan, DEFAULT_PLAN_DAYS[plan])) for plan in PLAN_LABELS}


def plan_price(plan) -> Decimal:
    raw = (getattr(settings, "SUBSCRIPTION_PRICES", {}) or {}).get(plan, "0")
    try:
        return Decimal(str(raw)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return Decimal("0.00")


def plan_catalog():
    """Public price list: what the student pays, in which currency, for how long."""
    currency = getattr(settings, "SUBSCRIPTION_CURRENCY", "SAR")
    return [
        {
            "id": plan,
            "label": PLAN_LABELS[plan],
            "label_en": PLAN_LABELS_EN[plan],
            "days": days,
            "price": str(plan_price(plan)),
            "currency": currency,
            "auto_renew": False,
            "live_classes": plan in Subscription.LIVE_PLANS,
        }
        for plan, days in plan_days_map().items()
    ]


@api_view(["GET"])
@permission_classes([AllowAny])
def subscription_plans(request):
    return Response(
        {
            "currency": getattr(settings, "SUBSCRIPTION_CURRENCY", "SAR"),
            "auto_renew": False,
            "plans": plan_catalog(),
        }
    )


def _activate(student, plan, method="card", reference="", amount=0):
    """Create/extend a subscription and log a successful payment."""
    today = timezone.now().date()
    current = student.subscriptions.filter(end_date__gte=today).order_by("-end_date").first()
    start = current.end_date if current else today
    end = start + timedelta(days=plan_days_map().get(plan, 365))
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
    plan = request.data.get("plan", "gold")
    method = request.data.get("method", "card")
    if plan not in PLAN_LABELS:
        return Response({"detail": "باقة غير صحيحة"}, status=status.HTTP_400_BAD_REQUEST)
    sub = _activate(
        request.user,
        plan,
        method=method,
        reference="DEV-AUTO",
        amount=plan_price(plan),
    )
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

    # Admin grants give full access, so they are recorded as the gold tier.
    plan = Subscription.Plan.GOLD

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
