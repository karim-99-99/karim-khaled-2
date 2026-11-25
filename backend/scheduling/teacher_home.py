"""Teacher home dashboard payload (Task 27 / B1)."""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.db.models import Max
from django.utils import timezone

from core.time_rules import (
    _tasks_payload_for_ended_session,
    class_state,
    session_ended,
    to_riyadh,
)

RIYADH = ZoneInfo("Asia/Riyadh")
UTC = dt_timezone.utc
JOIN_OPEN_BEFORE = timedelta(minutes=10)


def _day_bounds_utc(day):
    start_local = datetime.combine(day, time.min, tzinfo=RIYADH)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(UTC), end_local.astimezone(UTC)


def _fmt_time(dt) -> str:
    local = to_riyadh(dt)
    if local is None:
        return ""
    # 5:00 م style
    h = local.hour
    m = local.minute
    suffix = "ص" if h < 12 else "م"
    h12 = h % 12 or 12
    return f"{h12}:{m:02d} {suffix}"


def _first_name(full_name: str) -> str:
    parts = (full_name or "").strip().split()
    return parts[0] if parts else ""


def _teacher_scope(user):
    """Return (group_ids, subject_ids, assignments list)."""
    from groups.models import GroupTeacher

    if getattr(user, "is_admin_role", False):
        links = list(
            GroupTeacher.objects.select_related("group", "subject").all()
        )
    else:
        links = list(
            GroupTeacher.objects.filter(teacher=user).select_related(
                "group", "subject"
            )
        )
    group_ids = sorted({l.group_id for l in links})
    subject_ids = sorted({l.subject_id for l in links})
    return group_ids, subject_ids, links


def _primary_subject(user, links):
    from catalog.models import Subject

    sid = getattr(user, "taught_subject_id", None)
    if sid:
        subj = Subject.objects.filter(id=sid).first()
        if subj:
            return subj
    if links:
        return links[0].subject
    return None


def _session_action(session, now) -> str:
    """rate | join | not_started | rated"""
    if session_ended(session, now):
        if getattr(session, "rated_at", None):
            return "rated"
        return "rate"
    opens = session.start_time - JOIN_OPEN_BEFORE
    if now >= opens:
        return "join"
    return "not_started"


def _row_tone(session, now, action: str) -> str:
    if action == "rate":
        return "rate"
    state = class_state(session, now)
    if state in ("live", "waiting_teacher") or (
        action == "join" and now >= session.start_time
    ):
        return "now"
    return ""


def _serialize_session(session, now, student_count: int) -> dict:
    local = to_riyadh(session.start_time)
    today = to_riyadh(now).date()
    day_label = "اليوم"
    if local is not None:
        d = local.date()
        if d == today - timedelta(days=1):
            day_label = "أمس"
        elif d != today:
            day_label = f"{d.day}/{d.month}"
    action = _session_action(session, now)
    return {
        "id": session.id,
        "title": session.display_title,
        "group_id": session.group_id,
        "group_name": session.group.name if session.group_id else "",
        "student_count": student_count,
        "start_time": session.start_time.isoformat(),
        "end_time": session.end_time.isoformat(),
        "time_label": _fmt_time(session.start_time),
        "day_label": day_label,
        "state": class_state(session, now),
        "action": action,
        "tone": _row_tone(session, now, action),
        "is_rated": bool(getattr(session, "rated_at", None)),
        "can_join": action == "join",
        "is_extra": session.is_extra,
        "subject_id": session.subject_id,
        "subject_name": session.subject.name if session.subject_id else "",
    }


def _group_current_tasks(group_id, subject_ids, now):
    """Latest ended session per subject → task payloads for this group."""
    from scheduling.models import Session

    if not subject_ids:
        return []
    sessions = list(
        Session.objects.filter(group_id=group_id, subject_id__in=subject_ids)
        .select_related("subject", "group", "lesson")
        .order_by("start_time", "id")
    )
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
    latest = {}
    for s, idx in ended:
        prev = latest.get(s.subject_id)
        if prev is None or s.end_time >= prev[0].end_time:
            latest[s.subject_id] = (s, idx)
    tasks = []
    for s, idx in latest.values():
        tasks.extend(
            _tasks_payload_for_ended_session(
                s, foundation_index=idx if idx is not None else 0, now=now
            )
        )
    return tasks


def _student_late_days(student, now) -> int:
    from assessments.daily_tasks import (
        _answered_map,
        _build_ended_sessions,
        _day_bucket,
        _day_status,
    )

    answered = _answered_map(student.id)
    ended = _build_ended_sessions(student, now)
    days_map = _day_bucket(ended, answered, now)
    today = to_riyadh(now).date()
    late = 0
    cursor = today
    for _ in range(90):
        b = days_map.get(cursor)
        if b is None or not b.get("tasks"):
            cursor -= timedelta(days=1)
            continue
        is_today = cursor == today
        if is_today:
            done = sum(1 for t in b["tasks"] if t.get("is_done"))
            total = len(b["tasks"])
            if total and done < total:
                late += 1
                cursor -= timedelta(days=1)
                continue
            cursor -= timedelta(days=1)
            continue
        st, _done, _total = _day_status(b, is_today=False)
        if st == "complete":
            break
        if st in ("late", "partial"):
            late += 1
            cursor -= timedelta(days=1)
            continue
        break
    return late


def _rel_activity(dt, now) -> str:
    if dt is None:
        return "—"
    local = to_riyadh(dt)
    if local is None:
        return "—"
    today = to_riyadh(now).date()
    diff = (today - local.date()).days
    if diff <= 0:
        return "اليوم"
    if diff == 1:
        return "أمس"
    return f"قبل {diff} أيام"


def _status_payload(late_days: int) -> dict:
    if late_days <= 0:
        return {
            "key": "ok",
            "label": "ملتزم",
            "late_days": 0,
            "is_late": False,
        }
    if late_days == 1:
        return {
            "key": "late1",
            "label": "متأخر يوم",
            "late_days": 1,
            "is_late": True,
        }
    return {
        "key": "laten",
        "label": f"متأخر {late_days} أيام",
        "late_days": late_days,
        "is_late": True,
    }


def _bar_color(pct: int) -> str:
    if pct >= 80:
        return "green"
    if pct >= 50:
        return "orange"
    return "red"


def build_teacher_home(user, *, now=None) -> dict:
    from assessments.daily_tasks import _answered_map, enrich_task_completion
    from assessments.models import StudentPracticeAnswer
    from groups.models import GroupStudent, StudyGroup
    from scheduling.models import Session, sync_session_statuses

    now = now or timezone.now()
    group_ids, subject_ids, links = _teacher_scope(user)
    subject = _primary_subject(user, links)
    today = to_riyadh(now).date()
    yesterday = today - timedelta(days=1)
    today_start, today_end = _day_bounds_utc(today)
    y_start, y_end = _day_bounds_utc(yesterday)

    # Student counts per group
    student_links = list(
        GroupStudent.objects.filter(group_id__in=group_ids)
        .select_related("student", "group")
        .order_by("student__full_name", "id")
    ) if group_ids else []
    students_by_group: dict[int, list] = {}
    unique_students = {}
    for gl in student_links:
        students_by_group.setdefault(gl.group_id, []).append(gl.student)
        unique_students[gl.student_id] = gl.student

    group_student_count = {
        gid: len(students_by_group.get(gid, [])) for gid in group_ids
    }

    # Sessions today + yesterday for scoped groups/subjects
    sessions = []
    if group_ids and subject_ids:
        base_filter = Session.objects.filter(
            group_id__in=group_ids,
            subject_id__in=subject_ids,
            start_time__gte=y_start,
            start_time__lt=today_end,
        )
        sync_session_statuses(base_filter)
        sessions = list(
            base_filter.select_related(
                "subject", "group", "lesson", "teacher"
            ).order_by("start_time")
        )
    today_sessions = [
        s
        for s in sessions
        if today_start <= s.start_time < today_end
    ]
    list_sessions = [
        s
        for s in sessions
        if y_start <= s.start_time < today_end
    ]

    needs_rating_count = 0
    if group_ids and subject_ids:
        for s in Session.objects.filter(
            group_id__in=group_ids,
            subject_id__in=subject_ids,
            rated_at__isnull=True,
            start_time__lt=now,
        ).only("id", "start_time", "duration_minutes", "status", "rated_at"):
            if session_ended(s, now):
                needs_rating_count += 1

    my_classes = [
        _serialize_session(s, now, group_student_count.get(s.group_id, 0))
        for s in list_sessions
    ]

    # Next class: nearest not-ended among teacher's scope
    next_class = None
    if group_ids and subject_ids:
        upcoming = (
            Session.objects.filter(
                group_id__in=group_ids,
                subject_id__in=subject_ids,
            )
            .select_related("subject", "group", "lesson")
            .order_by("start_time")
        )
        for s in upcoming:
            if not session_ended(s, now):
                next_class = _serialize_session(
                    s, now, group_student_count.get(s.group_id, 0)
                )
                remaining = max(0, int((s.start_time - now).total_seconds()))
                next_class["remaining_seconds"] = remaining
                next_class["join_opens_at"] = (
                    s.start_time - JOIN_OPEN_BEFORE
                ).isoformat()
                break

    # Per-group task completion + student rows
    groups_out = []
    students_out = []
    total_task_slots = 0
    done_task_slots = 0
    late_student_ids = set()

    # Last activity bulk
    last_ans = {}
    if unique_students:
        for row in (
            StudentPracticeAnswer.objects.filter(
                student_id__in=list(unique_students.keys())
            )
            .values("student_id")
            .annotate(last=Max("answered_at"))
        ):
            last_ans[row["student_id"]] = row["last"]

    group_meta = {
        l.group_id: l.group for l in links
    }
    # Ensure StudyGroup objects for all group_ids
    for g in StudyGroup.objects.filter(id__in=group_ids):
        group_meta[g.id] = g

    subject_ids_by_group: dict[int, set] = {}
    for l in links:
        subject_ids_by_group.setdefault(l.group_id, set()).add(l.subject_id)

    for gid in group_ids:
        g = group_meta.get(gid)
        if not g:
            continue
        g_subjects = sorted(subject_ids_by_group.get(gid) or subject_ids)
        raw_tasks = _group_current_tasks(gid, g_subjects, now)
        hw_tasks = [t for t in raw_tasks if t.get("type") == "homework"]
        col_tasks = [t for t in raw_tasks if t.get("type") == "collection"]
        members = students_by_group.get(gid, [])
        y = len(members)
        hw_done = 0
        col_done = 0
        late_in_group = 0

        for student in members:
            answered = _answered_map(student.id)
            hw_items = [dict(t) for t in hw_tasks]
            col_items = [dict(t) for t in col_tasks]
            for item in hw_items + col_items:
                enrich_task_completion(item, answered, deadline=None)

            hw_total = len(hw_items)
            col_total = len(col_items)
            hw_finished = sum(1 for t in hw_items if t.get("is_done"))
            col_finished = sum(1 for t in col_items if t.get("is_done"))

            total_task_slots += hw_total + col_total
            done_task_slots += hw_finished + col_finished

            if not hw_items or hw_finished == hw_total:
                hw_done += 1
            if not col_items or col_finished == col_total:
                col_done += 1

            late_days = _student_late_days(student, now)
            status = _status_payload(late_days)
            if status["is_late"]:
                late_in_group += 1
                late_student_ids.add(student.id)

            students_out.append(
                {
                    "id": student.id,
                    "full_name": student.full_name,
                    "initial": (student.full_name or "?")[:1],
                    "group_id": gid,
                    "group_name": g.name,
                    "homework_done": hw_finished,
                    "homework_total": hw_total,
                    "collection_done": col_finished,
                    "collection_total": col_total,
                    "last_activity": _rel_activity(last_ans.get(student.id), now),
                    "last_activity_at": (
                        last_ans[student.id].isoformat()
                        if last_ans.get(student.id)
                        else None
                    ),
                    "status": status,
                    "reminded_recently": False,  # filled below for late students
                }
            )

        hw_pct = int(round(100 * hw_done / y)) if y else 0
        col_pct = int(round(100 * col_done / y)) if y else 0
        groups_out.append(
            {
                "id": gid,
                "name": g.name,
                "student_count": y,
                "late_count": late_in_group,
                "homework": {
                    "done": hw_done,
                    "total": y,
                    "pct": hw_pct,
                    "color": _bar_color(hw_pct),
                },
                "collections": {
                    "done": col_done,
                    "total": y,
                    "pct": col_pct,
                    "color": _bar_color(col_pct),
                },
            }
        )

    completion_pct = (
        int(round(100 * done_task_slots / total_task_slots))
        if total_task_slots
        else 0
    )

    # Reminder cooldown (Task 33): one / 24h / student / subject
    if late_student_ids and subject:
        from accounts.models import ParentReport

        since = now - timedelta(hours=24)
        recent_ids = set(
            ParentReport.objects.filter(
                student_id__in=late_student_ids,
                subject_id=subject.id,
                report_type=ParentReport.ReportType.REMINDER,
                created_at__gte=since,
            ).values_list("student_id", flat=True)
        )
        for row in students_out:
            if row["id"] in recent_ids:
                row["reminded_recently"] = True

    name = _first_name(getattr(user, "full_name", "") or "")
    subject_name = subject.name if subject else ""
    theme_key = getattr(subject, "theme_key", "") if subject else ""

    summary_late = len(late_student_ids)
    n_today = len(today_sessions)

    return {
        "teacher": {
            "id": user.id,
            "full_name": user.full_name,
            "first_name": name,
            "greeting": f"أهلاً أ. {name} 👋" if name else "أهلاً 👋",
        },
        "subject": {
            "id": subject.id if subject else None,
            "name": subject_name,
            "theme_key": theme_key,
            "role_label": f"مدرس {subject_name}" if subject_name else "مدرس",
        },
        "summary": {
            "text": (
                f"لديك {n_today} حصص اليوم و{summary_late} طلاب متأخرين في المهام"
                if n_today or summary_late
                else (
                    "لا حصص اليوم"
                    + (
                        f" · أقرب حصة: {next_class['title']}"
                        if next_class
                        else ""
                    )
                )
            ),
            "classes_today": n_today,
            "late_students": summary_late,
        },
        "kpis": {
            "classes_today": n_today,
            "students": len(unique_students),
            "groups": len(group_ids),
            "completion_pct": completion_pct,
            "needs_rating": needs_rating_count,
        },
        "next_class": next_class,
        "my_classes": my_classes,
        "groups": groups_out,
        "students": students_out,
        "now": now.isoformat(),
        "today": today.isoformat(),
    }
