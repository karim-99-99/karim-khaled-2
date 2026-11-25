"""Practice answers + daily-tasks page API (Task 20)."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.plans import assert_gold_feature, is_gold_student, is_silver_student

from .daily_tasks import build_daily_tasks_page
from .models import CollectionQuestion, HomeworkQuestion, StudentPracticeAnswer


class DailyTasksPageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.is_student:
            return Response({"detail": "للطلاب فقط"}, status=400)
        if is_silver_student(user) or not is_gold_student(user):
            assert_gold_feature(user, "المهام اليومية")
        try:
            past_limit = int(request.query_params.get("past_limit") or 7)
            past_offset = int(request.query_params.get("past_offset") or 0)
        except (TypeError, ValueError):
            past_limit, past_offset = 7, 0
        past_limit = max(1, min(past_limit, 30))
        past_offset = max(0, past_offset)
        data = build_daily_tasks_page(
            user, past_limit=past_limit, past_offset=past_offset
        )
        return Response(data)


class PracticeAnswerView(APIView):
    """
    POST { kind: homework|collection, question_id, selected_answer }
    GET  ?kind=&question_ids=1,2,3  → map of answered
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        kind = request.query_params.get("kind")
        raw = request.query_params.get("question_ids") or ""
        ids = [int(x) for x in raw.split(",") if x.strip().isdigit()]
        qs = StudentPracticeAnswer.objects.filter(student=request.user)
        if kind in (
            StudentPracticeAnswer.Kind.HOMEWORK,
            StudentPracticeAnswer.Kind.COLLECTION,
        ):
            qs = qs.filter(kind=kind)
        if ids:
            qs = qs.filter(question_id__in=ids)
        return Response(
            {
                "answers": {
                    str(r.question_id): {
                        "selected_answer": r.selected_answer,
                        "is_correct": r.is_correct,
                        "answered_at": r.answered_at,
                    }
                    for r in qs
                }
            }
        )

    def post(self, request):
        user = request.user
        if not user.is_student:
            return Response({"detail": "للطلاب فقط"}, status=400)
        kind = request.data.get("kind")
        question_id = request.data.get("question_id")
        selected = (request.data.get("selected_answer") or "").strip()
        if kind not in (
            StudentPracticeAnswer.Kind.HOMEWORK,
            StudentPracticeAnswer.Kind.COLLECTION,
        ):
            return Response({"detail": "kind غير صالح"}, status=400)
        if not question_id or not selected:
            return Response(
                {"detail": "أرسل question_id و selected_answer"},
                status=400,
            )
        try:
            question_id = int(question_id)
        except (TypeError, ValueError):
            return Response({"detail": "question_id غير صالح"}, status=400)

        if kind == StudentPracticeAnswer.Kind.HOMEWORK:
            q = HomeworkQuestion.objects.filter(
                id=question_id, needs_review=False
            ).first()
        else:
            q = CollectionQuestion.objects.filter(
                id=question_id, needs_review=False
            ).first()
        if not q:
            return Response({"detail": "السؤال غير موجود"}, status=404)

        is_correct = selected == (q.correct_answer or "")
        row, _ = StudentPracticeAnswer.objects.update_or_create(
            student=user,
            kind=kind,
            question_id=question_id,
            defaults={
                "selected_answer": selected,
                "is_correct": is_correct,
            },
        )
        return Response(
            {
                "question_id": question_id,
                "kind": kind,
                "selected_answer": row.selected_answer,
                "is_correct": row.is_correct,
                "answered_at": row.answered_at,
                "correct_answer": q.correct_answer,
            },
            status=status.HTTP_200_OK,
        )
