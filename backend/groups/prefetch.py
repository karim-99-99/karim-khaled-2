"""Prefetch helpers to avoid N+1 subscription queries on group lists."""

from django.db.models import Count, Prefetch, Q
from django.utils import timezone

from billing.models import Subscription


def today():
    return timezone.now().date()


def active_subs_prefetch(prefix=""):
    """
    Prefetch active subscriptions onto User as `_active_subs`.

    prefix examples:
      "" -> "subscriptions"
      "student__" -> "student__subscriptions"
      "student_links__student__" -> "student_links__student__subscriptions"
    """
    path = f"{prefix}subscriptions"
    return Prefetch(
        path,
        queryset=Subscription.objects.filter(end_date__gte=today()).order_by("-end_date"),
        to_attr="_active_subs",
    )


def study_group_queryset(base=None):
    """Annotated + prefetched queryset for StudyGroup list endpoints."""
    from .models import StudyGroup

    qs = base if base is not None else StudyGroup.objects.all()
    return (
        qs.annotate(
            _student_count_ann=Count("student_links", distinct=True),
            _active_count_ann=Count(
                "student_links__student",
                filter=Q(student_links__student__subscriptions__end_date__gte=today()),
                distinct=True,
            ),
        )
        .prefetch_related(
            "student_links__student",
            active_subs_prefetch("student_links__student__"),
            "teacher_links__teacher",
            "teacher_links__subject",
        )
        .order_by("name")
    )


def group_student_links_queryset(group):
    return group.student_links.select_related("student").prefetch_related(
        active_subs_prefetch("student__")
    )
