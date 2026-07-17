import random

from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Lesson, Subject
from core.access import free_question_limit, lesson_is_free_preview, user_has_full_content_access
from core.permissions import IsTeacherOrAdmin
from groups.models import GroupStudent, GroupTeacher
from .models import (
    CollectionQuestion,
    Exam,
    ExamAnswer,
    ExamLesson,
    HomeworkQuestion,
)
from .serializers import (
    CollectionQuestionSerializer,
    ExamAnswerReviewSerializer,
    ExamSerializer,
    HomeworkPublicSerializer,
    HomeworkQuestionSerializer,
    QuestionPublicSerializer,
)


# ---- Preset difficulty ratios for teacher tests (easy, medium, hard) ----
PRESET_RATIOS = {
    "easy": (0.70, 0.20, 0.10),
    "medium": (0.35, 0.45, 0.20),
    "hard": (0.20, 0.40, 0.40),
}


def _teacher_scope(user):
    """(group_ids, subject_ids) a teacher is allowed to manage."""
    links = GroupTeacher.objects.filter(teacher=user)
    group_ids = set(links.values_list("group_id", flat=True))
    subject_ids = set(links.values_list("subject_id", flat=True))
    return group_ids, subject_ids


class TeacherQuestionMixin:
    permission_classes = [IsTeacherOrAdmin]

    def get_queryset(self):
        user = self.request.user
        qs = self.model.objects.all()
        # A teacher manages the questions THEY authored (not group-bound).
        if not user.is_admin_role:
            qs = qs.filter(created_by=user)
        for field in ("group", "subject", "lesson", "difficulty"):
            val = self.request.query_params.get(field)
            if val and field in [f.name for f in self.model._meta.get_fields()]:
                qs = qs.filter(**{field: val})
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        group = serializer.validated_data.get("group")
        subject = serializer.validated_data.get("subject")
        # Group is optional. If a specific group is pinned, a teacher must
        # actually teach that subject there. Group-less questions reach all of
        # the teacher's groups automatically, so no group check is needed.
        if not user.is_admin_role and group is not None:
            if not GroupTeacher.objects.filter(
                teacher=user, group=group, subject=subject
            ).exists():
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("لا تُدرّس هذه المادة في هذه المجموعة")
        serializer.save(created_by=user)


class HomeworkQuestionViewSet(TeacherQuestionMixin, viewsets.ModelViewSet):
    model = HomeworkQuestion
    serializer_class = HomeworkQuestionSerializer


class CollectionQuestionViewSet(TeacherQuestionMixin, viewsets.ModelViewSet):
    model = CollectionQuestion
    serializer_class = CollectionQuestionSerializer


class StudentHomeworkView(APIView):
    """Homework for a student: authored by the teachers of their group(s)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        group_ids = _student_group_ids(user)
        teacher_ids = list(
            GroupTeacher.objects.filter(group_id__in=group_ids).values_list(
                "teacher_id", flat=True
            )
        )
        qs = HomeworkQuestion.objects.filter(created_by__in=teacher_ids).filter(
            Q(group__isnull=True) | Q(group_id__in=group_ids)
        )
        lesson_id = request.query_params.get("lesson")
        if lesson_id:
            qs = qs.filter(lesson_id=lesson_id)

        # Non-activated / non-subscribed: only first lesson + first 10 questions.
        if not user_has_full_content_access(user):
            if lesson_id:
                lesson = Lesson.objects.filter(id=lesson_id).first()
                if lesson and not lesson_is_free_preview(lesson):
                    return Response([])
            qs = qs.order_by("id")[: free_question_limit()]
            return Response(HomeworkPublicSerializer(qs, many=True).data)

        return Response(HomeworkPublicSerializer(qs, many=True).data)


def _student_group_ids(user):
    return list(
        GroupStudent.objects.filter(student=user).values_list("group_id", flat=True)
    )


def _student_question_bank(user, subject_id):
    """
    Questions a student may receive for a subject: authored by any teacher who
    teaches that subject in one of the student's groups. Group-less questions
    reach every group; group-pinned questions only their own group.
    Returns (queryset, group_ids).
    """
    group_ids = _student_group_ids(user)
    teacher_ids = list(
        GroupTeacher.objects.filter(
            group_id__in=group_ids, subject_id=subject_id
        ).values_list("teacher_id", flat=True)
    )
    qs = CollectionQuestion.objects.filter(
        subject_id=subject_id, created_by__in=teacher_ids
    ).filter(Q(group__isnull=True) | Q(group_id__in=group_ids))
    return qs, group_ids


def _pick(pool, n):
    pool = list(pool)
    random.shuffle(pool)
    return pool[:n]


class StartSimulatorView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        subject_id = request.data.get("subject")
        lesson_ids = request.data.get("lessons", [])
        count = int(request.data.get("count", 8))
        level = request.data.get("level", "medium")

        bank, group_ids = _student_question_bank(user, subject_id)
        bank = bank.filter(difficulty=level)
        if lesson_ids:
            bank = bank.filter(lesson_id__in=lesson_ids)

        free = not user_has_full_content_access(user)
        if free:
            # Only the first lesson of the subject is open for free preview.
            first = (
                Lesson.objects.filter(subject_id=subject_id, is_archived=False)
                .order_by("order_number", "id")
                .first()
            )
            if first:
                bank = bank.filter(lesson_id=first.id)
            if lesson_ids and first and any(int(x) != first.id for x in lesson_ids):
                return Response(
                    {"detail": "المعاينة المجانية متاحة لأول درس فقط. تواصل مع الإدارة للتفعيل."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            count = min(count, free_question_limit())
            free_bank = bank.filter(free_order__isnull=False).order_by("free_order")
            questions = list(free_bank[:count]) or _pick(bank, count)
        else:
            questions = _pick(bank, count)

        if not questions:
            return Response(
                {"detail": "لا توجد أسئلة متاحة بهذه الإعدادات"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exam = Exam.objects.create(
            student=user,
            subject_id=subject_id,
            group_id=group_ids[0] if group_ids else None,
            exam_type=Exam.Type.SIMULATOR,
            difficulty_preset=level,
            review_mode=Exam.ReviewMode.FINAL,
            question_count=len(questions),
            is_free_attempt=free,
        )
        for lid in lesson_ids:
            ExamLesson.objects.get_or_create(exam=exam, lesson_id=lid)
        for i, q in enumerate(questions):
            ExamAnswer.objects.create(exam=exam, question=q, order=i)

        return Response(_exam_payload(exam), status=201)


class StartTeacherTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        subject_id = request.data.get("subject")
        lesson_id = request.data.get("lesson")
        count = int(request.data.get("count", 20))
        preset = request.data.get("preset", "medium")
        review_mode = request.data.get("review_mode", "immediate")

        base, group_ids = _student_question_bank(user, subject_id)
        if lesson_id:
            base = base.filter(lesson_id=lesson_id)

        free = not user_has_full_content_access(user)
        if free:
            first = (
                Lesson.objects.filter(subject_id=subject_id, is_archived=False)
                .order_by("order_number", "id")
                .first()
            )
            if first:
                if lesson_id and int(lesson_id) != first.id:
                    return Response(
                        {
                            "detail": "المعاينة المجانية متاحة لأول درس فقط. تواصل مع الإدارة للتفعيل."
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )
                base = base.filter(lesson_id=first.id)
            count = min(count, free_question_limit())

        ratios = PRESET_RATIOS.get(preset, PRESET_RATIOS["medium"])
        buckets = ("easy", "medium", "hard")
        chosen = []
        for level, ratio in zip(buckets, ratios):
            n = round(count * ratio)
            chosen += _pick(base.filter(difficulty=level), n)
        # Top up if rounding left us short.
        if len(chosen) < count:
            remaining = base.exclude(id__in=[q.id for q in chosen])
            chosen += _pick(remaining, count - len(chosen))
        chosen = chosen[:count]

        if not chosen:
            return Response(
                {"detail": "لا توجد أسئلة كافية في بنك التجميعات"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exam = Exam.objects.create(
            student=user,
            subject_id=subject_id,
            group_id=group_ids[0] if group_ids else None,
            exam_type=Exam.Type.TEACHER,
            difficulty_preset=preset,
            review_mode=review_mode,
            question_count=len(chosen),
            is_free_attempt=free,
        )
        if lesson_id:
            ExamLesson.objects.get_or_create(exam=exam, lesson_id=lesson_id)
        random.shuffle(chosen)
        for i, q in enumerate(chosen):
            ExamAnswer.objects.create(exam=exam, question=q, order=i)

        return Response(_exam_payload(exam), status=201)


def _exam_payload(exam):
    answers = exam.answers.select_related("question").order_by("order")
    questions = [
        {
            "answer_id": a.id,
            "order": a.order,
            "selected_answer": a.selected_answer,
            "skipped": a.skipped,
            **QuestionPublicSerializer(a.question).data,
        }
        for a in answers
    ]
    return {
        "exam": ExamSerializer(exam).data,
        "questions": questions,
    }


class ExamDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, exam_id):
        exam = Exam.objects.filter(id=exam_id, student=request.user).first()
        if not exam:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(_exam_payload(exam))


class AnswerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, exam_id):
        exam = Exam.objects.filter(id=exam_id, student=request.user).first()
        if not exam:
            return Response(status=status.HTTP_404_NOT_FOUND)
        answer_id = request.data.get("answer_id")
        selected = request.data.get("selected", "")
        skipped = bool(request.data.get("skipped", False))
        ans = exam.answers.filter(id=answer_id).select_related("question").first()
        if not ans:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ans.selected_answer = selected
        ans.skipped = skipped
        ans.is_correct = (not skipped) and selected == ans.question.correct_answer
        ans.answered_at = timezone.now()
        ans.save()

        payload = {"saved": True}
        # Immediate review reveals correctness right away.
        if exam.review_mode == Exam.ReviewMode.IMMEDIATE:
            payload.update(
                {
                    "is_correct": ans.is_correct,
                    "correct_answer": ans.question.correct_answer,
                    "written_correction": ans.question.written_correction,
                    "video_bunny_id": ans.question.video_bunny_id,
                }
            )
        return Response(payload)


class FinishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, exam_id):
        exam = Exam.objects.filter(id=exam_id, student=request.user).first()
        if not exam:
            return Response(status=status.HTTP_404_NOT_FOUND)
        total = exam.answers.count()
        correct = exam.answers.filter(is_correct=True).count()
        exam.score_percent = round((correct / total) * 100, 1) if total else 0
        exam.status = Exam.Status.FINISHED
        exam.finished_at = timezone.now()
        exam.save()
        return Response(ExamSerializer(exam).data)


class MyResultsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        exams = Exam.objects.filter(
            student=request.user, status__in=["finished", "auto_submitted"]
        )
        return Response(ExamSerializer(exams, many=True).data)


class ExamReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, exam_id):
        exam = Exam.objects.filter(id=exam_id, student=request.user).first()
        if not exam:
            return Response(status=status.HTTP_404_NOT_FOUND)
        answers = exam.answers.select_related("question").order_by("order")
        if request.query_params.get("filter") == "wrong":
            answers = answers.filter(is_correct=False)
        return Response(
            {
                "exam": ExamSerializer(exam).data,
                "answers": ExamAnswerReviewSerializer(answers, many=True).data,
            }
        )
