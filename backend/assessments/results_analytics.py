"""Student results dashboard analytics (Task 25 / brief Page 7)."""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Count, Q
from django.utils import timezone

from catalog.models import Lesson, Subject
from core.plans import is_silver_student
from .models import (
    CollectionQuestion,
    Exam,
    ExamAnswer,
    StudentPracticeAnswer,
)

RIYADH = ZoneInfo("Asia/Riyadh")

PERIODS = ("today", "7d", "30d", "90d", "all")

IMPROVEMENT_LABELS = {
    "today": "تحسّن اليوم",
    "7d": "تحسّن آخر أسبوع",
    "30d": "تحسّن آخر شهر",
    "90d": "تحسّن آخر 3 شهور",
    "all": "تحسّن آخر شهر",
}


def parse_period(raw: str | None) -> str:
    key = (raw or "all").strip().lower()
    if key in ("1d", "day"):
        return "today"
    if key in ("3m", "90"):
        return "90d"
    if key in PERIODS:
        return key
    return "all"


def _aware(dt: datetime) -> datetime:
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.utc)
    return dt


def period_window(period: str, now=None) -> tuple[datetime | None, datetime]:
    """Inclusive start (UTC) and end (now) for the selected period."""
    now = now or timezone.now()
    local = now.astimezone(RIYADH)
    if period == "today":
        start_local = local.replace(hour=0, minute=0, second=0, microsecond=0)
        return start_local.astimezone(timezone.utc), now
    if period == "7d":
        return now - timedelta(days=7), now
    if period == "30d":
        return now - timedelta(days=30), now
    if period == "90d":
        return now - timedelta(days=90), now
    return None, now


def previous_window(period: str, now=None) -> tuple[datetime, datetime]:
    """Previous window of the same length (for improvement)."""
    now = now or timezone.now()
    start, end = period_window(period if period != "all" else "30d", now=now)
    if start is None:
        start = end - timedelta(days=30)
    length = end - start
    return start - length, start


def _score(correct: int, total: int) -> float | None:
    if total < 1:
        return None
    return round((correct / total) * 100, 1)


def _analytics_types(user) -> list[str]:
    """Exams that count in header / subjects / focus / الكل tab."""
    if is_silver_student(user):
        return [Exam.Type.SIMULATOR]
    return [Exam.Type.SIMULATOR, Exam.Type.TEACHER]


def _finished_exams(user, types, start, end):
    qs = Exam.objects.filter(
        student=user,
        status__in=[Exam.Status.FINISHED, Exam.Status.AUTO_SUBMITTED],
        exam_type__in=types,
    )
    if start is not None:
        qs = qs.filter(finished_at__gte=start, finished_at__lte=end)
    else:
        qs = qs.filter(finished_at__lte=end)
    return qs


def _attempt_scores(exams_qs) -> list[float]:
    scores = []
    for e in exams_qs.annotate(
        _c=Count("answers", filter=Q(answers__is_correct=True)),
        _t=Count("answers"),
    ):
        total = e._t or e.question_count or 0
        s = _score(e._c, total)
        if s is not None:
            scores.append(s)
    return scores


def _avg(scores: list[float]) -> float | None:
    if not scores:
        return None
    return round(sum(scores) / len(scores), 1)


def build_header_stats(user, period: str, now=None) -> dict:
    now = now or timezone.now()
    types = _analytics_types(user)
    start, end = period_window(period, now=now)
    exams = _finished_exams(user, types, start, end)
    scores = _attempt_scores(exams)
    avg = _avg(scores)
    best = max(scores) if scores else None

    prev_start, prev_end = previous_window(period, now=now)
    prev_scores = _attempt_scores(
        _finished_exams(user, types, prev_start, prev_end)
    )
    prev_avg = _avg(prev_scores)
    improvement = None
    hide = True
    if avg is not None and prev_avg is not None and prev_scores:
        improvement = round(avg - prev_avg, 1)
        hide = False

    return {
        "attempt_count": len(scores),
        "avg_score": avg,
        "best_score": best,
        "improvement": improvement,
        "improvement_label": IMPROVEMENT_LABELS.get(period, "تحسّن"),
        "improvement_hidden": hide,
    }


def build_subject_levels(user, period: str, now=None) -> list[dict]:
    now = now or timezone.now()
    types = _analytics_types(user)
    start, end = period_window(period, now=now)
    exam_ids = list(
        _finished_exams(user, types, start, end).values_list("id", flat=True)
    )
    subjects = list(Subject.objects.order_by("order", "id"))
    rows = []
    for subj in subjects:
        if not exam_ids:
            rows.append(
                {
                    "id": subj.id,
                    "name": subj.name,
                    "theme_key": subj.theme_key or "",
                    "percent": None,
                    "attempt_count": 0,
                }
            )
            continue
        ans = ExamAnswer.objects.filter(
            exam_id__in=exam_ids, question__subject_id=subj.id
        )
        total = ans.count()
        correct = ans.filter(is_correct=True).count()
        attempt_count = (
            ExamAnswer.objects.filter(
                exam_id__in=exam_ids, question__subject_id=subj.id
            )
            .values("exam_id")
            .distinct()
            .count()
        )
        rows.append(
            {
                "id": subj.id,
                "name": subj.name,
                "theme_key": subj.theme_key or "",
                "percent": _score(correct, total),
                "attempt_count": attempt_count,
            }
        )
    return rows


def build_focus_lessons(user, period: str, now=None, limit: int = 5) -> list[dict]:
    now = now or timezone.now()
    types = _analytics_types(user)
    start, end = period_window(period, now=now)
    exam_ids = list(
        _finished_exams(user, types, start, end).values_list("id", flat=True)
    )
    if not exam_ids:
        return []

    # Answered = not skipped and has a selection (محلولة).
    answered_q = Q(skipped=False) & ~Q(selected_answer="")
    stats = (
        ExamAnswer.objects.filter(exam_id__in=exam_ids)
        .values(
            "question__lesson_id",
            "question__lesson__title",
            "question__subject_id",
            "question__subject__name",
            "question__subject__theme_key",
        )
        .annotate(
            answered=Count("id", filter=answered_q),
            correct=Count("id", filter=Q(is_correct=True)),
            total=Count("id"),
        )
        .filter(answered__gte=10)
    )
    lessons = []
    for row in stats:
        lid = row["question__lesson_id"]
        if not lid:
            continue
        percent = _score(row["correct"], row["total"])
        if percent is None:
            continue
        lessons.append(
            {
                "lesson_id": lid,
                "lesson_title": row["question__lesson__title"] or "",
                "subject_id": row["question__subject_id"],
                "subject_name": row["question__subject__name"] or "",
                "theme_key": row["question__subject__theme_key"] or "",
                "percent": percent,
                "answered": row["answered"],
            }
        )
    lessons.sort(key=lambda r: (r["percent"], r["lesson_id"]))
    return lessons[:limit]


def _type_badge(exam: Exam) -> str:
    if exam.exam_type == Exam.Type.TEACHER:
        return "اختبار مدرس"
    if exam.exam_type == Exam.Type.COLLECTION:
        return "تجميعات"
    title = (exam.title_override or exam.title or "").strip()
    if exam.question_count >= 110 or "كامل" in title:
        return "محاكي كامل"
    return "محاكي شخصي"


def _duration_minutes(exam: Exam) -> int | None:
    if not exam.finished_at or not exam.started_at:
        return None
    secs = (exam.finished_at - exam.started_at).total_seconds()
    if secs < 0:
        return None
    return max(1, int(round(secs / 60)))


def _relative_date(finished_at, now=None) -> str:
    if not finished_at:
        return "—"
    now = now or timezone.now()
    local = finished_at.astimezone(RIYADH)
    today = now.astimezone(RIYADH).date()
    d = local.date()
    if d == today:
        return "اليوم"
    if d == today - timedelta(days=1):
        return "أمس"
    # Arabic-friendly short date
    months = [
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
    ]
    return f"{d.day} {months[d.month]}"


def build_attempts(user, period: str, now=None) -> list[dict]:
    now = now or timezone.now()
    types = _analytics_types(user)
    start, end = period_window(period, now=now)
    exams = (
        _finished_exams(user, types, start, end)
        .select_related("subject")
        .annotate(
            _ann_correct=Count("answers", filter=Q(answers__is_correct=True)),
            _ann_wrong=Count(
                "answers",
                filter=Q(answers__is_correct=False, answers__skipped=False),
            ),
            _ann_answered=Count(
                "answers",
                filter=Q(answers__skipped=False)
                & ~Q(answers__selected_answer=""),
            ),
            _ann_total=Count("answers"),
        )
        .order_by("-finished_at", "-id")
    )
    rows = []
    for e in exams:
        total = e._ann_total or e.question_count or 0
        correct = e._ann_correct or 0
        wrong = e._ann_wrong or 0
        unanswered = max(0, total - (e._ann_answered or 0))
        percent = _score(correct, total) or 0
        # Subject chips from answers (multi-subject mocks).
        subj_rows = (
            ExamAnswer.objects.filter(exam=e)
            .values(
                "question__subject_id",
                "question__subject__name",
                "question__subject__theme_key",
            )
            .distinct()
        )
        subjects = []
        seen = set()
        for s in subj_rows:
            sid = s["question__subject_id"]
            if not sid or sid in seen:
                continue
            seen.add(sid)
            subjects.append(
                {
                    "id": sid,
                    "name": s["question__subject__name"] or "",
                    "theme_key": s["question__subject__theme_key"] or "",
                }
            )
        if not subjects and e.subject_id:
            subjects = [
                {
                    "id": e.subject_id,
                    "name": e.subject.name,
                    "theme_key": e.subject.theme_key or "",
                }
            ]
        rows.append(
            {
                "id": e.id,
                "title": e.title,
                "exam_type": e.exam_type,
                "type_badge": _type_badge(e),
                "percent": percent,
                "correct_count": correct,
                "wrong_count": wrong,
                "unanswered_count": unanswered,
                "question_count": total,
                "subjects": subjects,
                "date_label": _relative_date(e.finished_at, now=now),
                "duration_minutes": _duration_minutes(e),
                "finished_at": e.finished_at,
            }
        )
    return rows


def build_collections_report(user, period: str, now=None) -> list[dict]:
    """Simple per-lesson report for التجميعات tab."""
    now = now or timezone.now()
    start, end = period_window(period, now=now)

    # From collection exam attempts.
    col_exams = Exam.objects.filter(
        student=user,
        exam_type=Exam.Type.COLLECTION,
        status__in=[Exam.Status.FINISHED, Exam.Status.AUTO_SUBMITTED],
    )
    if start is not None:
        col_exams = col_exams.filter(finished_at__gte=start, finished_at__lte=end)
    else:
        col_exams = col_exams.filter(finished_at__lte=end)
    exam_ids = list(col_exams.values_list("id", flat=True))

    lesson_stats: dict[int, dict] = {}

    if exam_ids:
        for row in (
            ExamAnswer.objects.filter(exam_id__in=exam_ids)
            .values(
                "question__lesson_id",
                "question__lesson__title",
                "question__subject_id",
                "question__subject__name",
                "question__subject__theme_key",
            )
            .annotate(
                correct=Count("id", filter=Q(is_correct=True)),
                wrong=Count(
                    "id",
                    filter=Q(is_correct=False, skipped=False)
                    & ~Q(selected_answer=""),
                ),
                solved=Count(
                    "id", filter=Q(skipped=False) & ~Q(selected_answer="")
                ),
            )
        ):
            lid = row["question__lesson_id"]
            if not lid:
                continue
            bucket = lesson_stats.setdefault(
                lid,
                {
                    "lesson_id": lid,
                    "lesson_title": row["question__lesson__title"] or "",
                    "subject_id": row["question__subject_id"],
                    "subject_name": row["question__subject__name"] or "",
                    "theme_key": row["question__subject__theme_key"] or "",
                    "solved": 0,
                    "correct": 0,
                    "wrong": 0,
                },
            )
            bucket["solved"] += row["solved"]
            bucket["correct"] += row["correct"]
            bucket["wrong"] += row["wrong"]

    # From daily-task practice answers (collection kind).
    practice = StudentPracticeAnswer.objects.filter(
        student=user, kind=StudentPracticeAnswer.Kind.COLLECTION
    )
    if start is not None:
        practice = practice.filter(answered_at__gte=start, answered_at__lte=end)
    else:
        practice = practice.filter(answered_at__lte=end)
    q_ids = list(practice.values_list("question_id", flat=True))
    if q_ids:
        q_meta = {
            q.id: q
            for q in CollectionQuestion.objects.filter(id__in=q_ids).select_related(
                "lesson", "subject"
            )
        }
        for ans in practice:
            q = q_meta.get(ans.question_id)
            if not q or not q.lesson_id:
                continue
            bucket = lesson_stats.setdefault(
                q.lesson_id,
                {
                    "lesson_id": q.lesson_id,
                    "lesson_title": q.lesson.title if q.lesson_id else "",
                    "subject_id": q.subject_id,
                    "subject_name": q.subject.name if q.subject_id else "",
                    "theme_key": (q.subject.theme_key if q.subject_id else "") or "",
                    "solved": 0,
                    "correct": 0,
                    "wrong": 0,
                },
            )
            # Avoid double-counting if same question also in a collection exam —
            # practice rows are separate sessions; count them additively as solved attempts.
            bucket["solved"] += 1
            if ans.is_correct:
                bucket["correct"] += 1
            else:
                bucket["wrong"] += 1

    if not lesson_stats:
        return []

    totals = {
        row["lesson_id"]: row["c"]
        for row in CollectionQuestion.objects.filter(
            lesson_id__in=lesson_stats.keys(), needs_review=False
        )
        .values("lesson_id")
        .annotate(c=Count("id"))
    }
    out = []
    for lid, bucket in lesson_stats.items():
        solved = bucket["solved"]
        correct = bucket["correct"]
        wrong = bucket["wrong"]
        total_in_lesson = totals.get(lid, 0)
        out.append(
            {
                **bucket,
                "total_in_lesson": total_in_lesson,
                "percent": _score(correct, solved) if solved else None,
            }
        )
    out.sort(key=lambda r: (-(r["solved"] or 0), r["lesson_title"]))
    return out


def build_results_dashboard(user, period_raw: str | None, now=None) -> dict:
    now = now or timezone.now()
    period = parse_period(period_raw)
    return {
        "period": period,
        "show_teacher_tab": not is_silver_student(user),
        "stats": build_header_stats(user, period, now=now),
        "subjects": build_subject_levels(user, period, now=now),
        "focus_lessons": build_focus_lessons(user, period, now=now),
        "attempts": build_attempts(user, period, now=now),
        "collections": build_collections_report(user, period, now=now),
    }
