"""
Shared time-rules service (brief rule 0.4).

ONE place that answers, for a student or group:
  - next class
  - class started / ended
  - teacher joined (BBB / zoom flag — read-only)
  - lessons taken (foundation classes whose start has arrived)
  - released tasks (stub until Tasks linking ships in phase 2)

Times are stored UTC (USE_TZ); display helpers use Asia/Riyadh.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from django.db.models import Q
from django.utils import timezone

RIYADH = ZoneInfo("Asia/Riyadh")


def to_riyadh(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.utc)
    return dt.astimezone(RIYADH)


def student_group_ids(user) -> list[int]:
    from groups.models import GroupStudent

    if user is None or not getattr(user, "is_authenticated", False):
        return []
    return list(
        GroupStudent.objects.filter(student=user).values_list("group_id", flat=True)
    )


def group_sessions_qs(group_ids, subject_id=None):
    from scheduling.models import Session

    qs = Session.objects.filter(group_id__in=group_ids).select_related(
        "subject", "group", "teacher"
    )
    if subject_id is not None:
        qs = qs.filter(subject_id=subject_id)
    return qs


def session_started(session, now=None) -> bool:
    now = now or timezone.now()
    return now >= session.start_time


def session_ended(session, now=None) -> bool:
    now = now or timezone.now()
    return now > session.end_time


def teacher_joined(session) -> bool:
    """Read-only: existing Zoom/BBB join flags — do not change BBB code."""
    if getattr(session, "teacher_joined_zoom", False):
        return True
    if getattr(session, "bbb_meeting_id", ""):
        # Meeting id exists; join state still comes from teacher_joined_zoom.
        return bool(session.teacher_joined_zoom)
    return False


def next_class_for_student(user, now=None):
    """Nearest live or upcoming session for the student's groups."""
    from scheduling.models import Session, sync_session_statuses

    now = now or timezone.now()
    group_ids = student_group_ids(user)
    if not group_ids:
        return None
    sync_session_statuses(
        Session.objects.filter(group_id__in=group_ids)
        .exclude(status=Session.Status.DONE)
        .filter(Q(start_time__lte=now) | Q(status=Session.Status.LIVE))
    )
    qs = (
        Session.objects.filter(group_id__in=group_ids)
        .filter(
            Q(status=Session.Status.LIVE)
            | (Q(start_time__gte=now) & ~Q(status=Session.Status.DONE))
        )
        .select_related("subject", "group", "teacher")
        .order_by("start_time")
    )
    return qs.first()


def next_class_for_group(group_id, now=None):
    from scheduling.models import Session

    now = now or timezone.now()
    return (
        Session.objects.filter(group_id=group_id)
        .filter(
            Q(status=Session.Status.LIVE)
            | (Q(start_time__gte=now) & ~Q(status=Session.Status.DONE))
        )
        .select_related("subject", "group", "teacher")
        .order_by("start_time")
        .first()
    )


def lessons_taken_for_student(user, subject_id=None, now=None):
    """
    Foundation sessions whose start time has arrived for the student's groups.
    Extra classes do NOT count as taken lessons (brief 2.1c).
    Returns list of dicts with session + optional lesson_id when linked later.
    """
    now = now or timezone.now()
    group_ids = student_group_ids(user)
    if not group_ids:
        return []
    qs = group_sessions_qs(group_ids, subject_id).filter(start_time__lte=now)
    # Prefer foundation; if column missing mid-migrate, treat all as foundation
    if hasattr(qs.model, "session_type"):
        qs = qs.filter(session_type=qs.model.SessionType.FOUNDATION)
    rows = []
    for s in qs.order_by("start_time"):
        rows.append(
            {
                "session_id": s.id,
                "subject_id": s.subject_id,
                "group_id": s.group_id,
                "start_time": s.start_time,
                "ended": session_ended(s, now),
                "title": s.display_title,
            }
        )
    return rows


def released_tasks_for_student(user, now=None):
    """
    Tasks released when the last ended foundation class of each subject ends.
    Phase 1: return [] until lesson_collection_links exists (phase 2).
    """
    del user, now
    return []


def snapshot_for_student(user, now=None) -> dict:
    """Full time-rules payload for home / locks / simulators."""
    now = now or timezone.now()
    nxt = next_class_for_student(user, now)
    payload = {
        "now": now,
        "now_riyadh": to_riyadh(now).isoformat() if now else None,
        "group_ids": student_group_ids(user),
        "next_class": None,
        "lessons_taken": lessons_taken_for_student(user, now=now),
        "released_tasks": released_tasks_for_student(user, now=now),
    }
    if nxt:
        payload["next_class"] = {
            "id": nxt.id,
            "subject_id": nxt.subject_id,
            "subject_name": nxt.subject.name if nxt.subject_id else "",
            "group_id": nxt.group_id,
            "group_name": nxt.group.name if nxt.group_id else "",
            "start_time": nxt.start_time,
            "end_time": nxt.end_time,
            "started": session_started(nxt, now),
            "ended": session_ended(nxt, now),
            "teacher_joined": teacher_joined(nxt),
            "status": nxt.compute_status(now),
            "session_type": getattr(nxt, "session_type", "foundation"),
            "title": nxt.display_title,
            "is_extra": getattr(nxt, "session_type", "foundation") == "extra",
        }
    return payload
