"""Gold vs Silver subscription helpers (brief: Global — Subscription plans)."""

from billing.models import Subscription

# Plans that get live schedule, daily tasks, teacher tests, locks.
GOLD_PLANS = frozenset(Subscription.LIVE_PLANS) | frozenset({"gold"})
# Explicit silver (recorded-only). Legacy monthly treated as silver-like.
SILVER_PLANS = frozenset({"silver", "monthly"})


def active_plan_code(user) -> str | None:
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    if getattr(user, "is_teacher", False) or getattr(user, "is_admin_role", False):
        return "staff"
    sub = getattr(user, "active_subscription", None)
    if not sub:
        return None
    return sub.plan


def is_gold_student(user) -> bool:
    if user is None:
        return False
    if getattr(user, "is_teacher", False) or getattr(user, "is_admin_role", False):
        return True
    code = active_plan_code(user)
    return code in GOLD_PLANS


def is_silver_student(user) -> bool:
    if user is None:
        return False
    if getattr(user, "is_teacher", False) or getattr(user, "is_admin_role", False):
        return False
    code = active_plan_code(user)
    if code is None:
        return False
    return code not in GOLD_PLANS


def assert_gold_feature(user, feature_label="هذه الميزة"):
    """API guard: Silver (and free) students cannot use Gold-only features."""
    from rest_framework.exceptions import PermissionDenied

    if getattr(user, "is_teacher", False) or getattr(user, "is_admin_role", False):
        return
    if is_gold_student(user):
        return
    raise PermissionDenied(
        f"{feature_label} متاحة لباقة الذهبية فقط. الباقة الفضية لا تشمل الحصص المباشرة والمهام اليومية."
    )
