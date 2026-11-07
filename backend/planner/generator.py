"""
خوارزمية الجدول الذكي — نفس فكرة خطط يلو:
الطالب يحدد المدة والساعات والمواد، والخطة ترتّب له كل يوم ماذا يذاكر
(تأسيس ثم تجميعات مع أيام مراجعة دورية).
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from catalog.models import Lesson, Subject


MINUTES_FOUNDATION = 75
MINUTES_COLLECTIONS = 60
MINUTES_REVIEW = 45
REVIEW_EVERY_N_DAYS = 5


def _round_robin(queues: list[list]) -> list:
    """Merge per-subject queues round-robin so days mix subjects."""
    out = []
    queues = [list(q) for q in queues if q]
    while queues:
        next_queues = []
        for q in queues:
            out.append(q.pop(0))
            if q:
                next_queues.append(q)
        queues = next_queues
    return out


def build_work_units(subject_ids, include_foundation, include_collections):
    subjects = list(
        Subject.objects.filter(id__in=subject_ids).order_by("order", "id")
    )
    if not subjects:
        return [], []

    foundation_queues = []
    collection_queues = []
    for subj in subjects:
        lessons = list(
            Lesson.objects.filter(subject=subj, is_archived=False).order_by(
                "order_number", "id"
            )
        )
        if include_foundation:
            foundation_queues.append(
                [
                    {
                        "kind": "foundation",
                        "subject": subj,
                        "lesson": lesson,
                        "title": f"تأسيس · {subj.name} · {lesson.title}",
                        "detail": "شاهد الدرس والعناوين الفرعية وحل الواجب.",
                        "minutes": MINUTES_FOUNDATION,
                    }
                    for lesson in lessons
                ]
            )
        if include_collections:
            collection_queues.append(
                [
                    {
                        "kind": "collections",
                        "subject": subj,
                        "lesson": lesson,
                        "title": f"تجميع · {subj.name} · {lesson.title}",
                        "detail": "تمرّن على أسئلة التجميع (سهل / متوسط / صعب).",
                        "minutes": MINUTES_COLLECTIONS,
                    }
                    for lesson in lessons
                ]
            )

    # تأسيس أولاً ثم تجميعات (مثل خطط التحصيلي الشاملة).
    units = _round_robin(foundation_queues) + _round_robin(collection_queues)
    return subjects, units


def pack_into_days(units, days_count, hours_per_day, start_date):
    """Distribute units across days; insert a review day every REVIEW_EVERY_N_DAYS."""
    budget = max(30, int(float(hours_per_day) * 60))
    days = {i: [] for i in range(1, days_count + 1)}
    recent = []  # recent unit titles for review
    unit_i = 0

    for day in range(1, days_count + 1):
        task_date = start_date + timedelta(days=day - 1)
        # Periodic review day (light).
        if day > 1 and day % REVIEW_EVERY_N_DAYS == 0 and recent:
            sample = recent[-6:]
            days[day].append(
                {
                    "kind": "review",
                    "subject": None,
                    "lesson": None,
                    "title": "يوم مراجعة",
                    "detail": "راجع: " + " · ".join(sample),
                    "minutes": MINUTES_REVIEW,
                    "task_date": task_date,
                    "order_on_day": 1,
                }
            )
            continue

        used = 0
        order = 1
        while unit_i < len(units) and used + units[unit_i]["minutes"] <= budget + 15:
            u = units[unit_i]
            unit_i += 1
            days[day].append(
                {
                    **u,
                    "task_date": task_date,
                    "order_on_day": order,
                }
            )
            recent.append(u["title"].replace("تأسيس · ", "").replace("تجميع · ", ""))
            used += u["minutes"]
            order += 1

        # If a day would be empty but units remain, force one task.
        if not days[day] and unit_i < len(units):
            u = units[unit_i]
            unit_i += 1
            days[day].append(
                {
                    **u,
                    "task_date": task_date,
                    "order_on_day": 1,
                }
            )
            recent.append(u["title"].replace("تأسيس · ", "").replace("تجميع · ", ""))

        # Empty trailing days → light review / rest hint.
        if not days[day]:
            days[day].append(
                {
                    "kind": "review",
                    "subject": None,
                    "lesson": None,
                    "title": "مراجعة حرة أو راحة نشطة",
                    "detail": "أعد حل أخطاء سابقة أو اختبر نفسك في المحاكي.",
                    "minutes": MINUTES_REVIEW,
                    "task_date": task_date,
                    "order_on_day": 1,
                }
            )

    overflow = units[unit_i:]
    return days, overflow


def generate_plan_payload(
    *,
    subject_ids,
    days_count,
    hours_per_day,
    start_date,
    include_foundation=True,
    include_collections=True,
):
    days_count = max(7, min(120, int(days_count)))
    hours_per_day = Decimal(str(hours_per_day or 2))
    if hours_per_day < 1:
        hours_per_day = Decimal("1")
    if hours_per_day > 10:
        hours_per_day = Decimal("10")

    subjects, units = build_work_units(
        subject_ids, include_foundation, include_collections
    )
    if not units:
        return {
            "subjects": subjects,
            "hours_per_day": hours_per_day,
            "days": {},
            "overflow_count": 0,
            "total_units": 0,
            "error": "لا توجد دروس في المواد المختارة لتوليد الخطة",
        }

    days, overflow = pack_into_days(units, days_count, hours_per_day, start_date)
    return {
        "subjects": subjects,
        "hours_per_day": hours_per_day,
        "days": days,
        "overflow_count": len(overflow),
        "total_units": len(units),
        "error": None,
    }


def units_from_unfinished_tasks(tasks):
    """Convert unfinished content tasks into packable units (skip empty reviews)."""
    units = []
    for t in tasks:
        if t.kind == "review" and not t.lesson_id:
            continue
        units.append(
            {
                "kind": t.kind,
                "subject": t.subject,
                "lesson": t.lesson,
                "title": t.title,
                "detail": t.detail or "",
                "minutes": t.estimated_minutes or MINUTES_COLLECTIONS,
            }
        )
    return units


def reschedule_unfinished_payload(plan, *, from_day_index, from_date):
    """
    أعد توزيع المهام غير المنتهية على الأيام المتبقية من اليوم الحالي
    حتى نهاية الخطة — بنفس ساعات اليوم الأصلية.
    """
    remaining_days = plan.days_count - from_day_index + 1
    if remaining_days < 1:
        return {"error": "انتهت مدة الخطة — أنشئ خطة جديدة", "days": {}, "overflow_count": 0}

    unfinished = (
        plan.tasks.filter(is_done=False)
        .select_related("subject", "lesson")
        .order_by("day_index", "order_on_day", "id")
    )
    units = units_from_unfinished_tasks(unfinished)
    if not units:
        return {
            "error": "لا توجد مهام متبقية لإعادة الترتيب",
            "days": {},
            "overflow_count": 0,
            "rescheduled_units": 0,
        }

    packed, overflow = pack_into_days(
        units, remaining_days, plan.hours_per_day, from_date
    )
    # Remap local day 1..N → absolute day_index from_day_index..
    remapped = {}
    for local_day, tasks in packed.items():
        abs_day = from_day_index + local_day - 1
        remapped[abs_day] = tasks
    return {
        "error": None,
        "days": remapped,
        "overflow_count": len(overflow),
        "rescheduled_units": len(units),
        "remaining_days": remaining_days,
    }
