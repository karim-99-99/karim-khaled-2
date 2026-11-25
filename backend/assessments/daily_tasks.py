"""Student daily-tasks page payload (Task 20 / Page 12)."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from core.time_rules import (
    group_sessions_qs,
    session_ended,
    student_group_ids,
    to_riyadh,
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


def _fmt_day(d: date) -> str:
    # Python: Mon=0 … map to Arabic weekday for that date in Riyadh sense
    wd = _AR_WEEKDAYS[d.weekday()]
    return f"{wd} · {d.day} {_AR_MONTHS[d.month]}"


def _week_start_saturday(day: date) -> date:
    # Saturday=5 in Python weekday
    delta = (day.weekday() - 5) % 7
    return day - timedelta(days=delta)


def _question_ids_for_task(item: dict) -> list[int]:
    from assessments.models import CollectionQuestion, HomeworkQuestion

    if item["type"] == "homework":
        return list(
            HomeworkQuestion.objects.filter(
                homework_sub_lesson_id=item.get("homework_sub_lesson_id"),
                needs_review=False,
            ).values_list("id", flat=True)
        )
    main_id = item.get("collection_lesson_id")
    sub_id = item.get("collection_sub_lesson_id")
    qs = CollectionQuestion.objects.filter(lesson_id=main_id, needs_review=False)
    if sub_id:
        qs = qs.filter(sub_lesson_id=sub_id)
    return list(qs.values_list("id", flat=True))


def _answered_map(student_id: int) -> dict[tuple[str, int], datetime]:
    from assessments.models import StudentPracticeAnswer

    out = {}
    for row in StudentPracticeAnswer.objects.filter(student_id=student_id).only(
        "kind", "question_id", "answered_at"
    ):
        out[(row.kind, row.question_id)] = row.answered_at
    return out


def enrich_task_completion(item: dict, answered: dict, deadline: datetime | None):
    """Mutate item with is_done / completed_at / on_time / answered_count."""
    kind = item["type"]
    qids = _question_ids_for_task(item)
    item["question_ids"] = qids
    if not qids:
        item["is_done"] = False
        item["answered_count"] = 0
        item["completed_at"] = None
        item["on_time"] = False
        return item

    times = []
    for qid in qids:
        t = answered.get((kind, qid))
        if t is None:
            item["is_done"] = False
            item["answered_count"] = sum(
                1 for q in qids if answered.get((kind, q)) is not None
            )
            item["completed_at"] = None
            item["on_time"] = False
            return item
        times.append(t)

    completed_at = max(times)
    item["is_done"] = True
    item["answered_count"] = len(qids)
    item["completed_at"] = completed_at.isoformat()
    item["on_time"] = bool(deadline is None or completed_at <= deadline)
    return item


def _tasks_for_ended_session(session, foundation_index, now, answered):
    from core.time_rules import _tasks_payload_for_ended_session

    raw = _tasks_payload_for_ended_session(
        session, foundation_index=foundation_index or 0, now=now
    )
    # Deadline = end of the next session for same group (any subject)
    group_id = session.group_id
    nxt = (
        group_sessions_qs([group_id])
        .filter(start_time__gt=session.start_time)
        .order_by("start_time")
        .first()
    )
    deadline = nxt.end_time if nxt else None

    out = []
    for item in raw:
        enrich_task_completion(item, answered, deadline)
        item["href"] = _task_href(item)
        out.append(item)
    return out, deadline


def _task_href(item: dict) -> str:
    if item["type"] == "homework":
        return f"/lessons/{item['lesson_id']}?hw={item['homework_sub_lesson_id']}"
    if item.get("collection_sub_lesson_id"):
        return (
            f"/courses/{item['subject_id']}/collections/"
            f"{item['collection_lesson_id']}/sub/{item['collection_sub_lesson_id']}"
        )
    return f"/courses/{item['subject_id']}/collections/{item['collection_lesson_id']}"


def _build_ended_sessions(user, now):
    group_ids = student_group_ids(user)
    if not group_ids:
        return []
    sessions = list(
        group_sessions_qs(group_ids)
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
    return ended


def _day_bucket(ended_sessions, answered, now):
    """Map Riyadh date → {sessions, tasks, subjects}."""
    days = {}
    for s, idx in ended_sessions:
        local = to_riyadh(s.end_time)
        if local is None:
            continue
        d = local.date()
        bucket = days.setdefault(
            d,
            {
                "date": d.isoformat(),
                "sessions": [],
                "tasks": [],
                "subject_ids": [],
                "subject_names": [],
            },
        )
        tasks, _ = _tasks_for_ended_session(s, idx, now, answered)
        bucket["sessions"].append(s.id)
        bucket["tasks"].extend(tasks)
        if s.subject_id and s.subject_id not in bucket["subject_ids"]:
            bucket["subject_ids"].append(s.subject_id)
            bucket["subject_names"].append(s.subject.name if s.subject_id else "")
    return days


def _day_status(bucket, *, is_today: bool):
    tasks = bucket.get("tasks") or []
    total = len(tasks)
    if total == 0:
        return "empty", 0, 0
    done = sum(1 for t in tasks if t.get("is_done"))
    on_time_all = all(t.get("is_done") and t.get("on_time") for t in tasks)
    if is_today:
        return "today", done, total
    if done == 0:
        return "late", done, total
    if done == total and on_time_all:
        return "complete", done, total
    # finished all but some late, or partial
    if done == total:
        return "partial", done, total
    return "partial", done, total


def _streak(days_map: dict, today: date) -> int:
    """Consecutive on-time-complete days ending at yesterday (or today if complete)."""
    streak = 0
    cursor = today
    # If today is complete on-time, start from today; else from yesterday
    today_b = days_map.get(today)
    if today_b:
        st, done, total = _day_status(today_b, is_today=False)
        if st == "complete":
            pass  # count today
        else:
            cursor = today - timedelta(days=1)
    else:
        cursor = today - timedelta(days=1)

    # Walk backward up to 120 days
    for _ in range(120):
        b = days_map.get(cursor)
        if b is None or not b.get("tasks"):
            # no class / no tasks → skip without breaking
            cursor -= timedelta(days=1)
            continue
        st, done, total = _day_status(b, is_today=False)
        if st == "complete":
            streak += 1
            cursor -= timedelta(days=1)
            continue
        break
    return streak


def build_daily_tasks_page(user, *, now=None, past_limit=7, past_offset=0):
    from core.plans import assert_gold_feature, is_gold_student, is_silver_student

    now = now or timezone.now()
    if is_silver_student(user) or not is_gold_student(user):
        assert_gold_feature(user, "المهام اليومية")

    answered = _answered_map(user.id)
    ended = _build_ended_sessions(user, now)
    days_map = _day_bucket(ended, answered, now)

    today = to_riyadh(now).date()
    week_start = _week_start_saturday(today)
    week_days = []
    week_done = 0
    week_total = 0
    for i in range(7):
        d = week_start + timedelta(days=i)
        b = days_map.get(d) or {
            "date": d.isoformat(),
            "tasks": [],
            "subject_ids": [],
            "subject_names": [],
        }
        is_today = d == today
        status, done, total = _day_status(b, is_today=is_today)
        if total:
            week_done += done
            week_total += total
        week_days.append(
            {
                "date": d.isoformat(),
                "day": d.day,
                "weekday": _AR_WEEKDAYS[d.weekday()],
                "is_today": is_today,
                "status": status if total or is_today else "empty",
                "done": done,
                "total": total,
                "pct": int(round(100 * done / total)) if total else 0,
                "subject_ids": b.get("subject_ids") or [],
                "subject_names": b.get("subject_names") or [],
                "tasks": b.get("tasks") or [],
                "label": _fmt_day(d),
            }
        )

    today_bucket = days_map.get(today) or {
        "tasks": [],
        "subject_names": [],
        "subject_ids": [],
    }
    today_tasks = today_bucket.get("tasks") or []
    today_done = sum(1 for t in today_tasks if t.get("is_done"))
    today_total = len(today_tasks)
    subject_today = " · ".join(today_bucket.get("subject_names") or []) or ""

    # Past days (before today), most recent first
    past_dates = sorted(
        (d for d in days_map.keys() if d < today), reverse=True
    )
    slice_dates = past_dates[past_offset : past_offset + past_limit]
    past = []
    for d in slice_dates:
        b = days_map[d]
        status, done, total = _day_status(b, is_today=False)
        past.append(
            {
                "date": d.isoformat(),
                "day": d.day,
                "weekday": _AR_WEEKDAYS[d.weekday()],
                "label": _fmt_day(d),
                "status": status,
                "done": done,
                "total": total,
                "pct": int(round(100 * done / total)) if total else 0,
                "subject_ids": b.get("subject_ids") or [],
                "subject_names": b.get("subject_names") or [],
                "tasks": b.get("tasks") or [],
            }
        )

    streak = _streak(days_map, today)
    week_pct = int(round(100 * week_done / week_total)) if week_total else 0

    remaining = today_total - today_done
    if today_total == 0:
        message = "لا مهام اليوم — هتظهر بعد حصتك الجاية"
    elif remaining == 0:
        message = "خلّصت مهام اليوم 🎉"
    else:
        subj = subject_today or "اليوم"
        message = f"مادة اليوم {subj} · باقي لك {remaining} مهام — كمّل وحافظ على سلسلتك 💪"

    return {
        "today": today.isoformat(),
        "today_label": _fmt_day(today),
        "message": message,
        "subject_today": subject_today,
        "today_done": today_done,
        "today_total": today_total,
        "today_tasks": today_tasks,
        "streak": streak,
        "week_done": week_done,
        "week_total": week_total,
        "week_pct": week_pct,
        "week": week_days,
        "past": past,
        "past_has_more": past_offset + past_limit < len(past_dates),
        "past_offset": past_offset,
    }
