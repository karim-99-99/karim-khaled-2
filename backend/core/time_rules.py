"""
Shared time-rules service (brief rule 0.4 / Task 14).

ONE place that answers, for a student or group:
  - next class
  - class state (upcoming / waiting_teacher / live / ended)
  - teacher joined (BBB / zoom flag — read-only)
  - lessons taken (foundation classes whose scheduled end has passed)
  - lesson unlock (foundation class start has arrived)
  - released tasks (stub until Tasks linking ships)
  - class day (sessions + tasks for a calendar day)

Times are stored UTC (USE_TZ); display helpers use Asia/Riyadh.
Foundation sessions map to lessons by chronological order_number when no lesson FK.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Q
from django.utils import timezone

RIYADH = ZoneInfo("Asia/Riyadh")

# Public aliases matching the task brief names.
nextClass = None  # set below after defs
classState = None
teacherJoined = None
takenLessons = None
isLessonUnlocked = None
releasedTasks = None
classDay = None


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
        "subject", "group", "teacher", "lesson"
    )
    if subject_id is not None:
        qs = qs.filter(subject_id=subject_id)
    return qs


def foundation_sessions_qs(group_ids, subject_id=None):
    qs = group_sessions_qs(group_ids, subject_id)
    if hasattr(qs.model, "session_type"):
        qs = qs.filter(session_type=qs.model.SessionType.FOUNDATION)
    return qs


def session_started(session, now=None) -> bool:
    now = now or timezone.now()
    return now >= session.start_time


def session_ended(session, now=None) -> bool:
    """Ended by schedule end_time (not BBB meeting close)."""
    now = now or timezone.now()
    return now > session.end_time


def teacher_joined(session) -> bool:
    """Read-only: existing Zoom/BBB join flags — do not change BBB code."""
    if getattr(session, "teacher_joined_zoom", False):
        return True
    return False


def class_state(session, now=None) -> str:
    """
    upcoming | waiting_teacher | live | ended
    (Task 14 acceptance: before start → upcoming; after start without teacher →
    waiting_teacher; teacher in → live; after schedule end → ended).
    """
    now = now or timezone.now()
    if session_ended(session, now):
        return "ended"
    if not session_started(session, now):
        return "upcoming"
    if teacher_joined(session):
        return "live"
    return "waiting_teacher"


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
            | (
                Q(start_time__lte=now)
                & Q(start_time__gt=now - timedelta(hours=6))
                & ~Q(status=Session.Status.DONE)
            )
        )
        .select_related("subject", "group", "teacher", "lesson")
        .order_by("start_time")
    )
    # Prefer sessions that have not ended yet.
    for s in qs:
        if not session_ended(s, now):
            return s
    return None


def next_class_for_group(group_id, now=None):
    from scheduling.models import Session

    now = now or timezone.now()
    qs = (
        Session.objects.filter(group_id=group_id)
        .filter(
            Q(status=Session.Status.LIVE)
            | (Q(start_time__gte=now) & ~Q(status=Session.Status.DONE))
        )
        .select_related("subject", "group", "teacher", "lesson")
        .order_by("start_time")
    )
    for s in qs:
        if not session_ended(s, now):
            return s
    return None


def _foundation_started_count(user, subject_id, now=None) -> int:
    now = now or timezone.now()
    group_ids = student_group_ids(user)
    if not group_ids:
        return 0
    return foundation_sessions_qs(group_ids, subject_id).filter(
        start_time__lte=now
    ).count()


def _foundation_ended_count(user, subject_id, now=None) -> int:
    now = now or timezone.now()
    group_ids = student_group_ids(user)
    if not group_ids:
        return 0
    # end = start + duration; filter in Python for portable end_time property
    count = 0
    for s in foundation_sessions_qs(group_ids, subject_id).order_by("start_time"):
        if session_ended(s, now):
            count += 1
    return count


def lessons_taken_for_student(user, subject_id=None, now=None):
    """
    Foundation sessions whose scheduled end has passed (Task 14 takenLessons).
    Extra classes do NOT count. Silver callers should use is_lesson_unlocked instead.
    """
    now = now or timezone.now()
    group_ids = student_group_ids(user)
    if not group_ids:
        return []
    qs = foundation_sessions_qs(group_ids, subject_id)
    rows = []
    for s in qs.order_by("start_time"):
        if not session_ended(s, now):
            continue
        rows.append(
            {
                "session_id": s.id,
                "subject_id": s.subject_id,
                "group_id": s.group_id,
                "lesson_id": s.lesson_id,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "ended": True,
                "title": s.display_title,
            }
        )
    return rows


def taken_lesson_count_for_subject(user, subject_id, now=None) -> int:
    """Ended foundation classes for simulator eligibility."""
    return _foundation_ended_count(user, subject_id, now=now)


def is_lesson_unlocked(user, lesson, now=None) -> bool:
    """
    Silver: always True.
    Gold: True once the Nth foundation class for that subject has started
    (N = lesson.order_number), or lesson FK session has started.
    """
    from core.plans import is_gold_student, is_silver_student

    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_teacher", False) or getattr(user, "is_admin_role", False):
        return True
    if not getattr(user, "is_student", False):
        return True
    if is_silver_student(user):
        return True
    if not is_gold_student(user):
        return False

    now = now or timezone.now()
    group_ids = student_group_ids(user)
    if not group_ids:
        return False

    # Prefer explicit lesson link when present.
    linked = (
        foundation_sessions_qs(group_ids, lesson.subject_id)
        .filter(lesson_id=lesson.id)
        .order_by("start_time")
        .first()
    )
    if linked is not None:
        return session_started(linked, now)

    order = getattr(lesson, "order_number", None) or 0
    if order <= 0:
        return True
    return order <= _foundation_started_count(user, lesson.subject_id, now=now)


def lesson_is_schedule_locked(user, lesson, now=None) -> bool:
    """Inverse of is_lesson_unlocked for gold students."""
    from core.plans import is_gold_student, is_silver_student

    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_teacher", False) or getattr(user, "is_admin_role", False):
        return False
    if not getattr(user, "is_student", False):
        return False
    if is_silver_student(user) or not is_gold_student(user):
        return False
    return not is_lesson_unlocked(user, lesson, now=now)


def eligible_lesson_ids_for_simulator(user, subject_ids, now=None) -> list[int] | None:
    """
    Silver / staff: None = all lessons.
    Gold: lessons whose foundation class has ended (taken), by order_number / FK.
    """
    from catalog.models import Lesson
    from core.plans import is_gold_student, is_silver_student

    if user is None:
        return []
    if getattr(user, "is_teacher", False) or getattr(user, "is_admin_role", False):
        return None
    if is_silver_student(user) or not is_gold_student(user):
        return None
    allowed = []
    for sid in subject_ids:
        ended = _foundation_ended_count(user, sid, now=now)
        if ended <= 0:
            continue
        allowed.extend(
            Lesson.objects.filter(
                subject_id=sid, is_archived=False, order_number__lte=ended
            ).values_list("id", flat=True)
        )
        # Also include explicitly linked ended sessions
        group_ids = student_group_ids(user)
        for s in foundation_sessions_qs(group_ids, sid):
            if s.lesson_id and session_ended(s, now):
                allowed.append(s.lesson_id)
    return list(dict.fromkeys(allowed))


def _foundation_lesson_for_session(session, foundation_index: int):
    """Map Nth foundation session (0-based) to lesson by FK or order_number."""
    from catalog.models import Lesson

    if session.lesson_id:
        return Lesson.objects.filter(id=session.lesson_id).first()
    return (
        Lesson.objects.filter(
            subject_id=session.subject_id,
            is_archived=False,
            order_number=foundation_index + 1,
        )
        .order_by("id")
        .first()
    )


def _effective_collection_links(lesson_id=None, extra_session_id=None, group_id=None):
    from assessments.models import LessonCollectionLink

    qs = LessonCollectionLink.objects.select_related(
        "collection_lesson", "collection_sub_lesson"
    )
    if extra_session_id:
        scoped = qs.filter(extra_session_id=extra_session_id)
    else:
        scoped = qs.filter(lesson_id=lesson_id, extra_session__isnull=True)

    if group_id:
        override = scoped.filter(group_id=group_id)
        if override.exists():
            return list(override.order_by("order_number", "id"))
    return list(scoped.filter(group__isnull=True).order_by("order_number", "id"))


def _tasks_payload_for_ended_session(session, *, foundation_index=None, now=None):
    """Homework (auto) + linked collections for one ended session."""
    from assessments.models import CollectionQuestion, HomeworkSubLesson

    now = now or timezone.now()
    if not session_ended(session, now):
        return []

    items = []
    group_id = session.group_id
    is_extra = getattr(session, "session_type", "foundation") == "extra"

    if is_extra:
        links = _effective_collection_links(
            extra_session_id=session.id, group_id=group_id
        )
        lesson = None
    else:
        idx = foundation_index if foundation_index is not None else 0
        lesson = _foundation_lesson_for_session(session, idx)
        if lesson is None:
            return []
        from django.db.models import Count, Q

        for hw in HomeworkSubLesson.objects.filter(lesson_id=lesson.id).annotate(
            _qc=Count("questions", filter=Q(questions__needs_review=False))
        ).order_by("order_number", "id"):
            items.append(
                {
                    "id": f"hw-{hw.id}-s{session.id}",
                    "type": "homework",
                    "title": hw.title,
                    "question_count": hw._qc,
                    "subject_id": session.subject_id,
                    "subject_name": session.subject.name if session.subject_id else "",
                    "lesson_id": lesson.id,
                    "lesson_title": lesson.title,
                    "homework_sub_lesson_id": hw.id,
                    "session_id": session.id,
                    "group_id": group_id,
                    "released_at": session.end_time.isoformat(),
                    "is_extra": False,
                }
            )
        links = _effective_collection_links(lesson_id=lesson.id, group_id=group_id)

    for link in links:
        main = link.collection_lesson
        sub = link.collection_sub_lesson
        q_qs = CollectionQuestion.objects.filter(
            lesson_id=main.id, needs_review=False
        )
        if sub:
            q_qs = q_qs.filter(sub_lesson_id=sub.id)
            title = f"{main.title} › {sub.title}"
        else:
            title = main.title
        items.append(
            {
                "id": f"col-{link.id}-s{session.id}",
                "type": "collection",
                "title": title,
                "question_count": q_qs.count(),
                "subject_id": session.subject_id,
                "subject_name": session.subject.name if session.subject_id else "",
                "lesson_id": lesson.id if lesson else None,
                "lesson_title": lesson.title if lesson else session.display_title,
                "collection_lesson_id": main.id,
                "collection_sub_lesson_id": sub.id if sub else None,
                "link_id": link.id,
                "session_id": session.id,
                "group_id": group_id,
                "released_at": session.end_time.isoformat(),
                "is_extra": is_extra,
            }
        )
    return items


def lesson_unlock_datetime(user, lesson, now=None):
    """Scheduled start of the student's foundation class for this lesson (or None)."""
    if user is None or lesson is None:
        return None
    now = now or timezone.now()
    group_ids = student_group_ids(user)
    if not group_ids:
        return None
    linked = (
        foundation_sessions_qs(group_ids, lesson.subject_id)
        .filter(lesson_id=lesson.id)
        .order_by("start_time")
        .first()
    )
    if linked is not None:
        return linked.start_time
    order = getattr(lesson, "order_number", None) or 0
    if order <= 0:
        return None
    rows = list(
        foundation_sessions_qs(group_ids, lesson.subject_id).order_by("start_time")
    )
    idx = order - 1
    if 0 <= idx < len(rows):
        return rows[idx].start_time
    return None


def released_tasks_for_student(user, now=None, *, current_only=False):
    """
    Tasks released when their class has ended (Task 18).

    current_only=True → "المهام اليومية": per subject, tasks of the latest
    ended session for that subject (so two subjects same day both appear).
    current_only=False → all released tasks (history + current).
    """
    from core.plans import is_gold_student, is_silver_student

    now = now or timezone.now()
    if user is None or not getattr(user, "is_authenticated", False):
        return []
    if getattr(user, "is_teacher", False) or getattr(user, "is_admin_role", False):
        return []
    if not getattr(user, "is_student", False):
        return []
    # Silver has no live-class schedule → no schedule-tied daily tasks
    if is_silver_student(user) or not is_gold_student(user):
        return []

    group_ids = student_group_ids(user)
    if not group_ids:
        return []

    sessions = list(
        group_sessions_qs(group_ids)
        .select_related("subject", "group", "lesson")
        .order_by("start_time", "id")
    )

    # Foundation index per (group, subject) — 0-based chronological rank
    foundation_idx = {}
    ended = []
    for s in sessions:
        key = (s.group_id, s.subject_id)
        if getattr(s, "session_type", "foundation") == "foundation":
            idx = foundation_idx.get(key, 0)
            foundation_idx[key] = idx + 1
        else:
            idx = None
        if session_ended(s, now):
            ended.append((s, idx))

    if not ended:
        return []

    if current_only:
        # Latest ended session per subject (across groups the student is in)
        latest_by_subject = {}
        for s, idx in ended:
            prev = latest_by_subject.get(s.subject_id)
            if prev is None or s.end_time >= prev[0].end_time:
                latest_by_subject[s.subject_id] = (s, idx)
        ended = list(latest_by_subject.values())

    out = []
    for s, idx in ended:
        for item in _tasks_payload_for_ended_session(
            s, foundation_index=idx if idx is not None else 0, now=now
        ):
            item["is_current_daily"] = current_only or False
            out.append(item)

    if current_only:
        for item in out:
            item["is_current_daily"] = True

    # Attach completion flags (Task 20) when possible
    try:
        from assessments.daily_tasks import _answered_map, enrich_task_completion

        answered = _answered_map(user.id)
        for item in out:
            enrich_task_completion(item, answered, deadline=None)
    except Exception:
        for item in out:
            item.setdefault("is_done", False)
    return out


def class_day_for_student(user, day: date | None = None, now=None) -> dict:
    """Sessions (+ released tasks) for a calendar day in Asia/Riyadh."""
    now = now or timezone.now()
    day = day or to_riyadh(now).date()
    group_ids = student_group_ids(user)
    start_local = datetime.combine(day, time.min, tzinfo=RIYADH)
    end_local = start_local + timedelta(days=1)
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)
    sessions = []
    if group_ids:
        qs = group_sessions_qs(group_ids).filter(
            start_time__gte=start_utc, start_time__lt=end_utc
        )
        for s in qs.order_by("start_time"):
            sessions.append(
                {
                    "id": s.id,
                    "subject_id": s.subject_id,
                    "title": s.display_title,
                    "start_time": s.start_time,
                    "end_time": s.end_time,
                    "session_type": getattr(s, "session_type", "foundation"),
                    "is_extra": getattr(s, "session_type", "foundation") == "extra",
                    "state": class_state(s, now),
                    "teacher_joined": teacher_joined(s),
                }
            )
    return {
        "date": day.isoformat(),
        "sessions": sessions,
        "tasks": released_tasks_for_student(user, now=now),
    }


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
        "current_daily_tasks": released_tasks_for_student(
            user, now=now, current_only=True
        ),
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
            "state": class_state(nxt, now),
            "status": nxt.compute_status(now),
            "session_type": getattr(nxt, "session_type", "foundation"),
            "title": nxt.display_title,
            "is_extra": getattr(nxt, "session_type", "foundation") == "extra",
        }
    return payload


# Task 14 brief aliases
nextClass = next_class_for_student
classState = class_state
teacherJoined = teacher_joined
takenLessons = lessons_taken_for_student
isLessonUnlocked = is_lesson_unlocked
releasedTasks = released_tasks_for_student
classDay = class_day_for_student
