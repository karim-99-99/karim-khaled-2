"""Gold vs Silver subscription helpers (brief: Global — Subscription plans)."""

from billing.models import Subscription

# Plans that get live schedule, daily tasks, teacher tests, locks.
GOLD_PLANS = frozenset(Subscription.LIVE_PLANS) | frozenset({"gold"})
# Explicit silver (recorded-only). Legacy monthly treated as silver-like.
SILVER_PLANS = frozenset({"silver", "monthly"})

# Feature keys for can_access / UI + API (Task 12).
FEATURE_LIVE = "live"
FEATURE_SCHEDULE = "schedule"
FEATURE_DAILY_TASKS = "daily_tasks"
FEATURE_NEXT_CLASS = "next_class"
FEATURE_TEACHER_TESTS = "teacher_tests"
FEATURE_LESSON_LOCKS = "lesson_locks"

GOLD_ONLY_FEATURES = frozenset(
    {
        FEATURE_LIVE,
        FEATURE_SCHEDULE,
        FEATURE_DAILY_TASKS,
        FEATURE_NEXT_CLASS,
        FEATURE_TEACHER_TESTS,
        FEATURE_LESSON_LOCKS,
    }
)


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


def can_access(user, feature: str) -> bool:
    """
    Single plan gate used by API + mirrored on the frontend.
    Staff always pass. Gold-only features require an active gold-like plan.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_teacher", False) or getattr(user, "is_admin_role", False):
        return True
    if feature not in GOLD_ONLY_FEATURES:
        # Recorded / collections / simulators / results — gated elsewhere (free tier).
        return True
    return is_gold_student(user)


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
