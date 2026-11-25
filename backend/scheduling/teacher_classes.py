"""Teacher «حصصي» page payload (Task 28 / B2.1)."""

from __future__ import annotations

from datetime import date, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Count, Q
from django.utils import timezone

from core.time_rules import class_state, session_ended, to_riyadh
from scheduling.teacher_home import (
    JOIN_OPEN_BEFORE,
    _day_bounds_utc,
    _fmt_time,
    _primary_subject,
    _session_action,
    _teacher_scope,
)

RIYADH = ZoneInfo("Asia/Riyadh")
_AR_WEEKDAYS = (
    "الاثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
    "الأحد",
)
_AR_MONTHS = (
    "",
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
)


def _week_start_saturday(day: date) -> date:
    delta = (day.weekday() - 5) % 7
    return day - timedelta(days=delta)


def _ar_class_count(n: int) -> str:
    if n <= 0:
        return "إجازة"
    if n == 1:
        return "حصة واحدة"
    if n == 2:
        return "حصتان"
    if 3 <= n <= 10:
        return f"{n} حصص"
    return f"{n} حصة"


def _duration_label(mins: int) -> str:
    mins = int(mins or 60)
    if mins == 60:
        return "ساعة"
    if mins == 120:
        return "ساعتان"
    if mins % 60 == 0:
        h = mins // 60
        if h == 1:
            return "ساعة"
        if h == 2:
            return "ساعتان"
        if 3 <= h <= 10:
            return f"{h} ساعات"
        return f"{h} ساعة"
    return f"{mins} د"


def _day_heading(d: date, today: date) -> str:
    label = f"{_AR_WEEKDAYS[d.weekday()]} {d.day} {_AR_MONTHS[d.month]}"
    if d == today:
        return f"اليوم · {label}"
    if d == today + timedelta(days=1):
        return f"غداً · {label}"
    return label


def _attendance_maps(session_ids):
    from scheduling.models import SessionAttendance

    if not session_ids:
        return {}
    rows = (
        SessionAttendance.objects.filter(session_id__in=session_ids)
        .values("session_id")
        .annotate(
            present=Count("id", filter=Q(status=SessionAttendance.Status.PRESENT)),
            absent=Count("id", filter=Q(status=SessionAttendance.Status.ABSENT)),
        )
    )
    return {
        r["session_id"]: {
            "present": r["present"],
            "absent": r["absent"],
            "recorded": (r["present"] + r["absent"]) > 0,
        }
        for r in rows
    }


def _student_counts(group_ids):
    from groups.models import GroupStudent

    if not group_ids:
        return {}
    rows = (
        GroupStudent.objects.filter(group_id__in=group_ids)
        .values("group_id")
        .annotate(n=Count("id"))
    )
    return {r["group_id"]: r["n"] for r in rows}


def _status_pill(session, now) -> dict | None:
    """Pill for the class row (excluding extra badge)."""
    if session_ended(session, now):
        if getattr(session, "rated_at", None):
            return {"key": "rated", "label": "تم التقييم", "tone": "grey"}
        return {"key": "needs_rate", "label": "انتهت · لم تُقيّم", "tone": "red"}
    state = class_state(session, now)
    if state == "live":
        return {"key": "live", "label": "مباشر الآن", "tone": "green"}
    if state == "waiting_teacher":
        return {"key": "waiting", "label": "ستبدأ قريبًا", "tone": "orange"}
    remaining = session.start_time - now
    mins = int(remaining.total_seconds() // 60)
    if 0 < mins <= 60:
        return {
            "key": "soon",
            "label": f"تبدأ بعد {mins} د",
            "tone": "green",
        }
    return None


def _row_tone(session, now, action: str) -> str:
    if action == "rate":
        return "rate"
    pill = _status_pill(session, now)
    if pill and pill["key"] == "soon":
        return "soon"
    state = class_state(session, now)
    if state in ("live", "waiting_teacher"):
        return "soon"
    return "extra" if session.is_extra else ""


def _serialize(
    session,
    now,
    *,
    student_count: int,
    attendance: dict | None,
) -> dict:
    action = _session_action(session, now)
    local = to_riyadh(session.start_time)
    day_iso = local.date().isoformat() if local else None
    att = attendance or {}
    present = att.get("present", 0)
    meta_bits = [session.group.name if session.group_id else ""]
    if student_count:
        meta_bits.append(f"{student_count} طالب")
    if session_ended(session, now) and (att.get("recorded") or present):
        meta_bits.append(f"حضور {present} من {student_count}")
    pills = []
    status = _status_pill(session, now)
    if status:
        pills.append(status)
    if session.is_extra:
        pills.append({"key": "extra", "label": "حصة إضافية", "tone": "blue"})

    return {
        "id": session.id,
        "title": session.display_title,
        "group_id": session.group_id,
        "group_name": session.group.name if session.group_id else "",
        "student_count": student_count,
        "start_time": session.start_time.isoformat(),
        "end_time": session.end_time.isoformat(),
        "time_label": _fmt_time(session.start_time),
        "duration_label": _duration_label(session.duration_minutes),
        "duration_minutes": session.duration_minutes,
        "day": day_iso,
        "date_label": (
            f"{_AR_WEEKDAYS[local.weekday()]} {local.day} {_AR_MONTHS[local.month]} · {_fmt_time(session.start_time)}"
            if local
            else ""
        ),
        "state": class_state(session, now),
        "action": action,
        "tone": _row_tone(session, now, action),
        "is_rated": bool(getattr(session, "rated_at", None)),
        "is_extra": session.is_extra,
        "can_join": action == "join",
        "pills": pills,
        "meta": " · ".join(b for b in meta_bits if b),
        "attendance": {
            "present": present,
            "absent": att.get("absent", 0),
            "total": student_count,
            "recorded": bool(att.get("recorded")),
        },
        "subject_id": session.subject_id,
    }


def build_teacher_classes(
    user,
    *,
    group_id=None,
    selected_date: str | None = None,
    past_month: str | None = None,
    now=None,
) -> dict:
    from groups.models import GroupStudent, StudyGroup
    from scheduling.models import Session

    now = now or timezone.now()
    group_ids, subject_ids, links = _teacher_scope(user)
    subject = _primary_subject(user, links)
    today = to_riyadh(now).date()

    if group_id is not None:
        try:
            gid = int(group_id)
        except (TypeError, ValueError):
            gid = None
        if gid and gid in group_ids:
            scope_groups = [gid]
        else:
            scope_groups = list(group_ids)
    else:
        scope_groups = list(group_ids)

    groups_out = []
    counts = _student_counts(group_ids)
    for g in StudyGroup.objects.filter(id__in=group_ids).order_by("name"):
        groups_out.append(
            {
                "id": g.id,
                "name": g.name,
                "student_count": counts.get(g.id, 0),
            }
        )

    unique_students = (
        GroupStudent.objects.filter(group_id__in=group_ids)
        .values("student_id")
        .distinct()
        .count()
        if group_ids
        else 0
    )

    # Needs rating (all ended, unrated in scope)
    needs_rating = []
    oldest_unrated_id = None
    if group_ids and subject_ids:
        candidates = (
            Session.objects.filter(
                group_id__in=group_ids,
                subject_id__in=subject_ids,
                rated_at__isnull=True,
                start_time__lt=now,
            )
            .select_related("group", "subject")
            .order_by("start_time")
        )
        for s in candidates:
            if session_ended(s, now):
                needs_rating.append(s)
        if needs_rating:
            oldest_unrated_id = needs_rating[0].id

    # Week strip
    sel = today
    if selected_date:
        try:
            sel = date.fromisoformat(selected_date)
        except ValueError:
            sel = today
    week_start = _week_start_saturday(sel)
    week_end = week_start + timedelta(days=7)
    w_start_utc, _ = _day_bounds_utc(week_start)
    _, w_end_utc = _day_bounds_utc(week_end - timedelta(days=1))

    week_sessions = []
    if scope_groups and subject_ids:
        week_sessions = list(
            Session.objects.filter(
                group_id__in=scope_groups,
                subject_id__in=subject_ids,
                start_time__gte=w_start_utc,
                start_time__lt=w_end_utc,
            )
            .select_related("subject", "group", "lesson")
            .order_by("start_time")
        )

    by_day: dict[date, list] = {week_start + timedelta(days=i): [] for i in range(7)}
    for s in week_sessions:
        local = to_riyadh(s.start_time)
        if local is None:
            continue
        d = local.date()
        if d in by_day:
            by_day[d].append(s)

    week = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        n = len(by_day[d])
        week.append(
            {
                "date": d.isoformat(),
                "weekday": _AR_WEEKDAYS[d.weekday()],
                "day": d.day,
                "count": n,
                "count_label": _ar_class_count(n),
                "is_today": d == today,
                "is_selected": d == sel,
            }
        )

    # Load attendance for selected day + tomorrow + recent past + past tab
    tomorrow = today + timedelta(days=1)
    past_lookback = today - timedelta(days=60)
    past_start_utc, _ = _day_bounds_utc(past_lookback)
    _, tomorrow_end = _day_bounds_utc(tomorrow)

    range_sessions = []
    if scope_groups and subject_ids:
        range_sessions = list(
            Session.objects.filter(
                group_id__in=scope_groups,
                subject_id__in=subject_ids,
                start_time__gte=past_start_utc,
                start_time__lt=tomorrow_end,
            )
            .select_related("subject", "group", "lesson")
            .order_by("start_time")
        )

    att_map = _attendance_maps([s.id for s in range_sessions] + [s.id for s in needs_rating])
    scounts = _student_counts(scope_groups)

    def pack(rows):
        return [
            _serialize(
                s,
                now,
                student_count=scounts.get(s.group_id, 0),
                attendance=att_map.get(s.id),
            )
            for s in rows
        ]

    selected_rows = by_day.get(sel, [])
    # If selected day outside loaded week_sessions (shouldn't), refetch
    if not selected_rows and scope_groups and subject_ids:
        d0, d1 = _day_bounds_utc(sel)
        selected_rows = list(
            Session.objects.filter(
                group_id__in=scope_groups,
                subject_id__in=subject_ids,
                start_time__gte=d0,
                start_time__lt=d1,
            )
            .select_related("subject", "group", "lesson")
            .order_by("start_time")
        )

    t0, t1 = _day_bounds_utc(tomorrow)
    tomorrow_rows = [
        s
        for s in range_sessions
        if t0 <= s.start_time < t1
    ]

    past_ended = [
        s
        for s in range_sessions
        if session_ended(s, now)
    ]
    past_ended.sort(key=lambda s: s.start_time, reverse=True)
    recent_past = past_ended[:2]

    # Past tab — filter by month
    past_tab = past_ended
    months = sorted(
        {
            (to_riyadh(s.start_time).year, to_riyadh(s.start_time).month)
            for s in past_ended
            if to_riyadh(s.start_time)
        },
        reverse=True,
    )
    month_options = [
        {
            "value": f"{y}-{m:02d}",
            "label": f"{_AR_MONTHS[m]} {y}",
        }
        for y, m in months
    ]
    if past_month:
        try:
            y_str, m_str = past_month.split("-", 1)
            y, m = int(y_str), int(m_str)
            past_tab = [
                s
                for s in past_ended
                if (local := to_riyadh(s.start_time))
                and local.year == y
                and local.month == m
            ]
        except (ValueError, TypeError):
            pass

    needs_n = len(needs_rating)
    if needs_n == 0:
        alert_text = ""
    elif needs_n == 1:
        alert_text = "⭐ لديك حصة واحدة تحتاج تقييم · يظهر التقييم لولي الأمر في تقرير الطالب"
    elif needs_n == 2:
        alert_text = "⭐ لديك حصتان تحتاجان تقييم · يظهر التقييم لولي الأمر في تقرير الطالب"
    else:
        alert_text = (
            f"⭐ لديك {needs_n} حصص تحتاج تقييم · يظهر التقييم لولي الأمر في تقرير الطالب"
        )

    return {
        "subject": {
            "id": subject.id if subject else None,
            "name": subject.name if subject else "",
            "theme_key": getattr(subject, "theme_key", "") if subject else "",
            "role_label": f"مدرس {subject.name}" if subject else "مدرس",
        },
        "header": {
            "title": "حصصي",
            "subtitle": (
                f"{('مدرس ' + subject.name) if subject else 'مدرس'}"
                f" · {len(group_ids)} مجموعات · {unique_students} طالب"
            ),
            "groups": len(group_ids),
            "students": unique_students,
        },
        "groups": groups_out,
        "filter_group_id": scope_groups[0] if group_id and len(scope_groups) == 1 else None,
        "needs_rating": {
            "count": needs_n,
            "text": alert_text,
            "oldest_id": oldest_unrated_id,
        },
        "week": week,
        "week_start": week_start.isoformat(),
        "selected_date": sel.isoformat(),
        "selected_heading": _day_heading(sel, today),
        "selected_sessions": pack(selected_rows),
        "tomorrow": {
            "date": tomorrow.isoformat(),
            "heading": _day_heading(tomorrow, today),
            "sessions": pack(tomorrow_rows),
        },
        "recent_past": pack(recent_past),
        "past": {
            "sessions": pack(past_tab),
            "months": month_options,
            "month": past_month or (month_options[0]["value"] if month_options else None),
        },
        "today": today.isoformat(),
        "now": now.isoformat(),
        "join_open_minutes": int(JOIN_OPEN_BEFORE.total_seconds() // 60),
    }
