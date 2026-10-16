from datetime import date, datetime

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from catalog.models import Subject

from .generator import generate_plan_payload, reschedule_unfinished_payload
from .models import StudyPlan, StudyPlanTask
from .serializers import StudyPlanSerializer, StudyPlanSummarySerializer, _today_day_index


def _parse_date(value, default=None):
    if not value:
        return default
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return default


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def active_study_plan(request):
    plan = (
        StudyPlan.objects.filter(student=request.user, is_active=True)
        .annotate(
            _done_count=Count("tasks", filter=Q(tasks__is_done=True)),
            _total_count=Count("tasks"),
        )
        .prefetch_related("tasks__subject", "tasks__lesson")
        .first()
    )
    if not plan:
        return Response({"detail": "لا توجد خطة نشطة"}, status=status.HTTP_404_NOT_FOUND)
    return Response(StudyPlanSerializer(plan).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_study_plans(request):
    rows = (
        StudyPlan.objects.filter(student=request.user)
        .annotate(
            _done_count=Count("tasks", filter=Q(tasks__is_done=True)),
            _total_count=Count("tasks"),
        )
        .order_by("-is_active", "-created_at")
    )
    return Response(StudyPlanSummarySerializer(rows, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_study_plan(request):
    """
    أنشئ خطة مذاكرة ذكية:
    {
      subject_ids: [1,2],
      days_count: 60,
      hours_per_day: 2.5,
      start_date: "2026-10-16",
      exam_date: optional,
      include_foundation: true,
      include_collections: true,
      title: optional
    }
    """
    data = request.data or {}
    subject_ids = data.get("subject_ids") or []
    try:
        subject_ids = [int(x) for x in subject_ids]
    except (TypeError, ValueError):
        return Response({"detail": "subject_ids غير صالحة"}, status=400)
    if not subject_ids:
        return Response({"detail": "اختر مادة واحدة على الأقل"}, status=400)
    if not Subject.objects.filter(id__in=subject_ids).exists():
        return Response({"detail": "المواد غير موجودة"}, status=400)

    days_count = data.get("days_count") or 60
    try:
        days_count = int(days_count)
    except (TypeError, ValueError):
        return Response({"detail": "days_count غير صالح"}, status=400)

    hours_per_day = data.get("hours_per_day") or 2
    start_date = _parse_date(data.get("start_date"), timezone.localdate())
    exam_date = _parse_date(data.get("exam_date"), None)
    include_foundation = bool(data.get("include_foundation", True))
    include_collections = bool(data.get("include_collections", True))
    if not include_foundation and not include_collections:
        return Response(
            {"detail": "فعّل تأسيس أو تجميع (أو الاثنين)"},
            status=400,
        )

    payload = generate_plan_payload(
        subject_ids=subject_ids,
        days_count=days_count,
        hours_per_day=hours_per_day,
        start_date=start_date,
        include_foundation=include_foundation,
        include_collections=include_collections,
    )
    if payload.get("error"):
        return Response({"detail": payload["error"]}, status=400)

    names = " · ".join(s.name for s in payload["subjects"][:4])
    title = (data.get("title") or "").strip() or f"خطة {days_count} يوم — {names}"

    with transaction.atomic():
        StudyPlan.objects.filter(student=request.user, is_active=True).update(is_active=False)
        plan = StudyPlan.objects.create(
            student=request.user,
            title=title[:200],
            start_date=start_date,
            days_count=days_count,
            hours_per_day=payload["hours_per_day"],
            include_foundation=include_foundation,
            include_collections=include_collections,
            subject_ids=subject_ids,
            exam_date=exam_date,
            is_active=True,
        )
        rows = []
        for day_index, tasks in payload["days"].items():
            for t in tasks:
                rows.append(
                    StudyPlanTask(
                        plan=plan,
                        day_index=day_index,
                        task_date=t["task_date"],
                        kind=t["kind"],
                        subject=t.get("subject"),
                        lesson=t.get("lesson"),
                        title=t["title"][:300],
                        detail=t.get("detail") or "",
                        estimated_minutes=t.get("minutes") or 60,
                        order_on_day=t.get("order_on_day") or 1,
                    )
                )
        StudyPlanTask.objects.bulk_create(rows)

    plan = (
        StudyPlan.objects.filter(id=plan.id)
        .annotate(
            _done_count=Count("tasks", filter=Q(tasks__is_done=True)),
            _total_count=Count("tasks"),
        )
        .prefetch_related("tasks__subject", "tasks__lesson")
        .first()
    )
    out = StudyPlanSerializer(plan).data
    out["overflow_count"] = payload["overflow_count"]
    out["total_units"] = payload["total_units"]
    return Response(out, status=status.HTTP_201_CREATED)


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def study_plan_detail(request, plan_id):
    plan = (
        StudyPlan.objects.filter(id=plan_id, student=request.user)
        .annotate(
            _done_count=Count("tasks", filter=Q(tasks__is_done=True)),
            _total_count=Count("tasks"),
        )
        .prefetch_related("tasks__subject", "tasks__lesson")
        .first()
    )
    if not plan:
        return Response({"detail": "الخطة غير موجودة"}, status=404)
    if request.method == "DELETE":
        plan.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response(StudyPlanSerializer(plan).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_study_task(request, plan_id, task_id):
    task = (
        StudyPlanTask.objects.select_related("plan")
        .filter(id=task_id, plan_id=plan_id, plan__student=request.user)
        .first()
    )
    if not task:
        return Response({"detail": "المهمة غير موجودة"}, status=404)
    task.is_done = not task.is_done
    task.done_at = timezone.now() if task.is_done else None
    task.save(update_fields=["is_done", "done_at"])
    from .serializers import StudyPlanTaskSerializer

    return Response(StudyPlanTaskSerializer(task).data)


def _load_plan_for_user(user, plan_id):
    return (
        StudyPlan.objects.filter(id=plan_id, student=user)
        .annotate(
            _done_count=Count("tasks", filter=Q(tasks__is_done=True)),
            _total_count=Count("tasks"),
        )
        .prefetch_related("tasks__subject", "tasks__lesson")
        .first()
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reschedule_study_plan(request, plan_id):
    """
    لو الطالب فوّت أيام أو ما خلّصش المطلوب:
    يعيد توزيع المهام غير المنتهية على الأيام المتبقية فقط
    (من اليوم الحالي لنهاية الخطة) بنفس الساعات اليومية.
    المهام المنتهية تبقى كما هي.
    """
    plan = StudyPlan.objects.filter(id=plan_id, student=request.user).first()
    if not plan:
        return Response({"detail": "الخطة غير موجودة"}, status=404)
    if not plan.is_active:
        return Response({"detail": "هذه الخطة غير نشطة"}, status=400)

    today = timezone.localdate()
    today_index = _today_day_index(plan)
    # If plan hasn't started yet, reschedule from day 1 / start_date.
    if today < plan.start_date:
        from_day = 1
        from_date = plan.start_date
    else:
        from_day = today_index
        from_date = today

    payload = reschedule_unfinished_payload(
        plan, from_day_index=from_day, from_date=from_date
    )
    if payload.get("error"):
        return Response({"detail": payload["error"]}, status=400)

    with transaction.atomic():
        # احذف غير المنتهي فقط — المنتهي يبقى أرشيفاً في أيامه.
        StudyPlanTask.objects.filter(plan=plan, is_done=False).delete()
        rows = []
        for day_index, tasks in payload["days"].items():
            for t in tasks:
                rows.append(
                    StudyPlanTask(
                        plan=plan,
                        day_index=day_index,
                        task_date=t["task_date"],
                        kind=t["kind"],
                        subject=t.get("subject"),
                        lesson=t.get("lesson"),
                        title=t["title"][:300],
                        detail=t.get("detail") or "",
                        estimated_minutes=t.get("minutes") or 60,
                        order_on_day=t.get("order_on_day") or 1,
                    )
                )
        StudyPlanTask.objects.bulk_create(rows)

    plan = _load_plan_for_user(request.user, plan.id)
    out = StudyPlanSerializer(plan).data
    out["overflow_count"] = payload["overflow_count"]
    out["rescheduled_units"] = payload["rescheduled_units"]
    out["remaining_days"] = payload["remaining_days"]
    return Response(out)
