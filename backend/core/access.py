"""Free-tier / full-content access helpers.

Until an admin activates a student (grants a subscription) — or the student
subscribes themselves — they may browse the site but only:
  - watch the first lesson of each subject
  - answer the first FREE_TIER_QUESTION_LIMIT questions
"""

from django.conf import settings


def user_has_full_content_access(user) -> bool:
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_teacher", False) or getattr(user, "is_admin_role", False):
        return True
    return bool(getattr(user, "has_active_subscription", False))


def lesson_is_free_preview(lesson) -> bool:
    """First lesson of a subject (by order) or explicitly marked free."""
    if lesson is None:
        return False
    if getattr(lesson, "is_free_preview", False):
        return True
    return getattr(lesson, "order_number", None) == 1


def free_question_limit() -> int:
    return int(getattr(settings, "FREE_TIER_QUESTION_LIMIT", 10))
