import random

from django.db.models import Exists, OuterRef, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Lesson, Subject
from core.access import (
    assert_teacher_can_manage_subject,
    free_question_limit,
    lesson_is_free_preview,
    teacher_subject_ids,
    user_has_full_content_access,
)
from core.permissions import IsTeacherOrAdmin
from groups.models import GroupStudent, GroupTeacher
from .models import (
    CollectionQuestion,
    Exam,
    ExamAnswer,
    ExamLesson,
    HomeworkQuestion,
    TeacherTest,
    TeacherTestLesson,
    TeacherTestQuestion,
)
from .question_import import parse_upload
from .serializers import (
    CollectionQuestionSerializer,
    ExamAnswerReviewSerializer,
    ExamSerializer,
    HomeworkPublicSerializer,
    HomeworkQuestionSerializer,
    QuestionPublicSerializer,
    TeacherTestSerializer,
    TeacherTestWriteSerializer,
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
        for field in ("group", "subject", "lesson", "section", "difficulty"):
            val = self.request.query_params.get(field)
            if val and field in [f.name for f in self.model._meta.get_fields()]:
                qs = qs.filter(**{field: val})
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        subject = serializer.validated_data.get("subject")
        subject_id = subject.pk if hasattr(subject, "pk") else subject
        assert_teacher_can_manage_subject(user, subject_id)
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user
        subject = serializer.validated_data.get("subject", serializer.instance.subject_id)
        subject_id = subject.pk if hasattr(subject, "pk") else subject
        assert_teacher_can_manage_subject(user, serializer.instance.subject_id)
        assert_teacher_can_manage_subject(user, subject_id)
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        assert_teacher_can_manage_subject(user, instance.subject_id)
        if not user.is_admin_role and instance.created_by_id not in (None, user.id):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("لا يمكنك حذف سؤال أنشأه مدرس آخر")
        instance.delete()


class HomeworkQuestionViewSet(TeacherQuestionMixin, viewsets.ModelViewSet):
    """تأسيس: أسئلة الواجب تظهر فقط لطلاب مجموعات المدرس."""

    model = HomeworkQuestion
    serializer_class = HomeworkQuestionSerializer
    pagination_class = None

    def perform_create(self, serializer):
        user = self.request.user
        group = serializer.validated_data.get("group")
        subject = serializer.validated_data.get("subject")
        subject_id = subject.pk if hasattr(subject, "pk") else subject
        assert_teacher_can_manage_subject(user, subject_id)
        if not user.is_admin_role:
            from rest_framework.exceptions import PermissionDenied

            links = GroupTeacher.objects.filter(teacher=user, subject_id=subject_id)
            if not links.exists():
                raise PermissionDenied(
                    "عيّنك الإدارة كمدرس لهذه المادة في مجموعة أولاً حتى تظهر أسئلتك لطلاب مجموعتك"
                )
            if group is not None and not links.filter(group=group).exists():
                raise PermissionDenied("لا تُدرّس هذه المادة في هذه المجموعة")
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user
        subject = serializer.validated_data.get("subject", serializer.instance.subject_id)
        subject_id = subject.pk if hasattr(subject, "pk") else subject
        assert_teacher_can_manage_subject(user, serializer.instance.subject_id)
        assert_teacher_can_manage_subject(user, subject_id)
        group = serializer.validated_data.get("group", serializer.instance.group)
        if not user.is_admin_role and group is not None:
            gid = group.pk if hasattr(group, "pk") else group
            if not GroupTeacher.objects.filter(
                teacher=user, group_id=gid, subject_id=subject_id
            ).exists():
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("لا تُدرّس هذه المادة في هذه المجموعة")
        serializer.save()


class CollectionQuestionViewSet(TeacherQuestionMixin, viewsets.ModelViewSet):
    """تجميعات: بنك عام يظهر لكل طلاب المادة."""

    model = CollectionQuestion
    serializer_class = CollectionQuestionSerializer
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        qs = self.model.objects.all()
        if not user.is_admin_role:
            qs = qs.filter(subject_id__in=teacher_subject_ids(user))
        for field in ("group", "subject", "lesson", "section", "difficulty"):
            val = self.request.query_params.get(field)
            if val and field in [f.name for f in self.model._meta.get_fields()]:
                qs = qs.filter(**{field: val})
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        subject = serializer.validated_data.get("subject")
        subject_id = subject.pk if hasattr(subject, "pk") else subject
        assert_teacher_can_manage_subject(user, subject_id)
        serializer.save(created_by=user, group=None)

    def perform_update(self, serializer):
        user = self.request.user
        subject = serializer.validated_data.get("subject", serializer.instance.subject_id)
        subject_id = subject.pk if hasattr(subject, "pk") else subject
        assert_teacher_can_manage_subject(user, serializer.instance.subject_id)
        assert_teacher_can_manage_subject(user, subject_id)
        serializer.save(group=None)


IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024  # 5MB


class ImportCollectionQuestionsView(APIView):
    """
    رفع ملف أسئلة (Word .docx أو نصي .txt) إلى بنك تجميعات درس معيّن.

    POST multipart:
      file:   الملف
      lesson: معرّف الدرس
      mode:   preview (افتراضي — معاينة بدون حفظ) | commit (حفظ فعلي)

    الأسئلة الناقصة تُحفظ بعلامة needs_review ولا تظهر للطلاب حتى يعتمدها المدرس.
    """

    permission_classes = [IsTeacherOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        lesson_id = request.data.get("lesson")
        lesson = (
            Lesson.objects.filter(id=lesson_id).select_related("subject").first()
            if lesson_id
            else None
        )
        if not lesson:
            return Response(
                {"detail": "الدرس غير موجود"}, status=status.HTTP_400_BAD_REQUEST
            )
        assert_teacher_can_manage_subject(request.user, lesson.subject_id)

        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response(
                {"detail": "ارفع ملف Word (.docx) أو ملف نصي (.txt)"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if uploaded.size > IMPORT_MAX_FILE_BYTES:
            return Response(
                {"detail": "حجم الملف أكبر من 5MB"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            questions, errors = parse_upload(uploaded)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        summary = {
            "total": len(questions) + len(errors),
            "ready": sum(1 for q in questions if not q["needs_review"]),
            "needs_review": sum(1 for q in questions if q["needs_review"]),
            "rejected": len(errors),
        }

        mode = (request.data.get("mode") or "preview").strip().lower()
        if mode != "commit":
            return Response(
                {"mode": "preview", "summary": summary, "questions": questions,
                 "errors": errors}
            )

        if not questions:
            return Response(
                {"detail": "لا توجد أسئلة صالحة في الملف", "errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = CollectionQuestion.objects.bulk_create(
            [
                CollectionQuestion(
                    subject_id=lesson.subject_id,
                    lesson=lesson,
                    created_by=request.user,
                    group=None,
                    text=q["text"],
                    options=q["options"],
                    correct_answer=q["correct_answer"],
                    difficulty=q["difficulty"],
                    question_year=q["question_year"],
                    teacher_tier=q.get("teacher_tier") or "",
                    explanation=q["explanation"],
                    written_correction=q["explanation"],
                    video_bunny_id=q["video_bunny_id"],
                    needs_review=q["needs_review"],
                    review_notes=q["review_notes"],
                )
                for q in questions
            ]
        )
        return Response(
            {
                "mode": "commit",
                "summary": summary,
                "created": len(created),
                "errors": errors,
            },
            status=status.HTTP_201_CREATED,
        )


class ImportHomeworkQuestionsView(APIView):
    """
    رفع ملف أسئلة واجب تأسيس (Word .docx أو نصي .txt).

    POST multipart:
      file:    الملف
      lesson:  معرّف الدرس
      section: معرّف الحصة/العنوان الفرعي (اختياري — للربط بدرس فرعي)
      mode:    preview | commit
    """

    permission_classes = [IsTeacherOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        lesson_id = request.data.get("lesson")
        lesson = (
            Lesson.objects.filter(id=lesson_id).select_related("subject").first()
            if lesson_id
            else None
        )
        if not lesson:
            return Response(
                {"detail": "الدرس غير موجود"}, status=status.HTTP_400_BAD_REQUEST
            )
        assert_teacher_can_manage_subject(request.user, lesson.subject_id)

        section_id = request.data.get("section")
        section = None
        if section_id not in (None, ""):
            from catalog.models import LessonSection

            section = LessonSection.objects.filter(
                id=section_id, lesson_id=lesson.id
            ).first()
            if not section:
                return Response(
                    {"detail": "العنوان الفرعي لا ينتمي لهذا الدرس"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response(
                {"detail": "ارفع ملف Word (.docx) أو ملف نصي (.txt)"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if uploaded.size > IMPORT_MAX_FILE_BYTES:
            return Response(
                {"detail": "حجم الملف أكبر من 5MB"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            questions, errors = parse_upload(uploaded)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        summary = {
            "total": len(questions) + len(errors),
            "ready": sum(1 for q in questions if not q["needs_review"]),
            "needs_review": sum(1 for q in questions if q["needs_review"]),
            "rejected": len(errors),
        }

        mode = (request.data.get("mode") or "preview").strip().lower()
        if mode != "commit":
            return Response(
                {
                    "mode": "preview",
                    "summary": summary,
                    "questions": questions,
                    "errors": errors,
                }
            )

        if not questions:
            return Response(
                {"detail": "لا توجد أسئلة صالحة في الملف", "errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = HomeworkQuestion.objects.bulk_create(
            [
                HomeworkQuestion(
                    subject_id=lesson.subject_id,
                    lesson=lesson,
                    section=section,
                    created_by=request.user,
                    group=None,
                    text=q["text"],
                    options=q["options"],
                    correct_answer=q["correct_answer"],
                    difficulty=q["difficulty"],
                    explanation=q["explanation"],
                    video_bunny_id=q["video_bunny_id"],
                    needs_review=q["needs_review"],
                    review_notes=q["review_notes"],
                )
                for q in questions
            ]
        )
        return Response(
            {
                "mode": "commit",
                "summary": summary,
                "created": len(created),
                "errors": errors,
            },
            status=status.HTTP_201_CREATED,
        )


class StudentHomeworkView(APIView):
    """Homework authored by teachers assigned to the student's groups for that subject."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        group_ids = _student_group_ids(user)
        lesson_id = request.query_params.get("lesson")
        section_id = request.query_params.get("section")

        # Only teachers who teach the question's subject in one of the student's groups.
        qs = (
            HomeworkQuestion.objects.filter(needs_review=False)
            .filter(
                Exists(
                    GroupTeacher.objects.filter(
                        teacher_id=OuterRef("created_by_id"),
                        subject_id=OuterRef("subject_id"),
                        group_id__in=group_ids,
                    )
                )
            )
            .filter(Q(group__isnull=True) | Q(group_id__in=group_ids))
        )

        if section_id:
            qs = qs.filter(section_id=section_id)
        elif lesson_id:
            qs = qs.filter(lesson_id=lesson_id)

        # Non-activated / non-subscribed: only first lesson + first 10 questions.
        if not user_has_full_content_access(user):
            check_lesson_id = None
            if section_id:
                from catalog.models import LessonSection

                sec = (
                    LessonSection.objects.filter(id=section_id)
                    .select_related("lesson")
                    .first()
                )
                if sec:
                    check_lesson_id = sec.lesson_id
            elif lesson_id:
                check_lesson_id = lesson_id
            if check_lesson_id:
                lesson = Lesson.objects.filter(id=check_lesson_id).first()
                if lesson and not lesson_is_free_preview(lesson):
                    return Response([])
            qs = qs.order_by("id")[: free_question_limit()]
            return Response(HomeworkPublicSerializer(qs, many=True).data)

        return Response(HomeworkPublicSerializer(qs, many=True).data)


def _student_group_ids(user):
    return list(
        GroupStudent.objects.filter(student=user).values_list("group_id", flat=True)
    )


def _student_question_bank(user, subject_id=None, subject_ids=None):
    """
    تجميعات: بنك عام لكل طلاب المادة — أسئلة كل المدرسين تظهر للجميع.
    (عكس تأسيس/الواجب المقيد بمجموعات المدرس.)
    """
    group_ids = _student_group_ids(user)
    ids = []
    if subject_ids:
        ids = [int(x) for x in subject_ids if str(x).isdigit() or isinstance(x, int)]
    elif subject_id:
        ids = [int(subject_id)]
    # Imported-but-unreviewed questions are hidden from students.
    qs = CollectionQuestion.objects.filter(needs_review=False)
    if ids:
        qs = qs.filter(subject_id__in=ids)
    return qs, group_ids, ids


def _pick(pool, n):
    pool = list(pool)
    random.shuffle(pool)
    return pool[:n]


# Student difficulty presets → mix of easy/medium/hard question ratios.
# Medium totals 110 as specified by product; weights are normalized when picking.
DIFFICULTY_MIXES = {
    "easy": {"easy": 60, "medium": 35, "hard": 5},
    "medium": {"easy": 40, "medium": 60, "hard": 10},
    "advanced": {"easy": 25, "medium": 55, "hard": 20},
    "challenge": {"easy": 10, "medium": 40, "hard": 50},
}


def _pick_mixed(bank_qs, n, mix_key):
    """
    Draw ~n questions following DIFFICULTY_MIXES ratios.
    Falls back to other difficulties if a bucket runs short.
    Loads the bank once (not three difficulty queries).
    """
    raw = DIFFICULTY_MIXES.get(mix_key) or DIFFICULTY_MIXES["medium"]
    total_w = sum(raw.values()) or 1
    weights = {k: v / total_w for k, v in raw.items()}

    pools = {"easy": [], "medium": [], "hard": []}
    for q in bank_qs:
        if q.difficulty in pools:
            pools[q.difficulty].append(q)
    for key in pools:
        random.shuffle(pools[key])

    available = sum(len(v) for v in pools.values())
    if n is None or n > available:
        n = available
    if n < 1:
        return []

    # Allocate counts; fix rounding so sum == n
    alloc = {k: int(n * weights[k]) for k in ("easy", "medium", "hard")}
    while sum(alloc.values()) < n:
        order = sorted(weights.keys(), key=lambda k: -weights[k])
        grew = False
        for k in order:
            if pools[k] and alloc[k] < len(pools[k]):
                alloc[k] += 1
                grew = True
                break
        if not grew:
            # no room left in preferred buckets — fill any remaining below
            for k in order:
                if pools[k]:
                    alloc[k] += 1
                    grew = True
                    break
            if not grew:
                break
    while sum(alloc.values()) > n:
        order = sorted(weights.keys(), key=lambda k: weights[k])
        for k in order:
            if alloc[k] > 0:
                alloc[k] -= 1
                break

    picked = []
    leftover = []
    for diff in ("easy", "medium", "hard"):
        need = alloc[diff]
        bucket = pools[diff]
        take = bucket[:need]
        picked.extend(take)
        leftover.extend(bucket[need:])

    if len(picked) < n and leftover:
        random.shuffle(leftover)
        picked.extend(leftover[: n - len(picked)])

    random.shuffle(picked)
    return picked[:n]


def _seen_question_ids(user, subject_ids):
    """Collection question IDs this student has faced before in these subjects."""
    ids = list(subject_ids or [])
    qs = ExamAnswer.objects.filter(exam__student=user)
    if ids:
        qs = qs.filter(exam__subject_id__in=ids)
    return set(qs.values_list("question_id", flat=True))


class StartSimulatorView(APIView):
    """
    Personal simulator from تجميعات bank.

    Body:
      subject OR subjects[] (one or more),
      lessons[],
      years[] OR year (optional filter on question_year),
      count (used by personal simulator),
      take_all (true = كل أسئلة المستويات المختارة — للتجميعات),
      level (easy|medium|hard|all) OR levels[] (one or more of easy/medium/hard),
      review_mode (immediate|final),
      question_pool (any|new|seen),
      time_limit_minutes (null/0 = open, else minutes)
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        raw_subjects = request.data.get("subjects")
        subject_ids = []
        if isinstance(raw_subjects, list) and raw_subjects:
            for x in raw_subjects:
                try:
                    subject_ids.append(int(x))
                except (TypeError, ValueError):
                    continue
        elif request.data.get("subject"):
            try:
                subject_ids = [int(request.data.get("subject"))]
            except (TypeError, ValueError):
                subject_ids = []

        lesson_ids = request.data.get("lessons") or []
        try:
            lesson_ids = [int(x) for x in lesson_ids]
        except (TypeError, ValueError):
            return Response(
                {"detail": "قائمة الدروس غير صالحة"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_years = request.data.get("years")
        years = []
        if isinstance(raw_years, list):
            years = [str(y).strip() for y in raw_years if str(y).strip()]
        single_year = (request.data.get("year") or "").strip()
        if single_year and single_year not in years:
            years.append(single_year)

        raw_tiers = request.data.get("tiers") or request.data.get("teacher_tiers")
        tiers = []
        if isinstance(raw_tiers, list):
            tiers = [x for x in raw_tiers if x in ("gold", "silver", "bronze")]
        elif isinstance(raw_tiers, str) and raw_tiers in ("gold", "silver", "bronze"):
            tiers = [raw_tiers]

        take_all = bool(request.data.get("take_all"))
        try:
            count = int(request.data.get("count", 8))
        except (TypeError, ValueError):
            count = 8
        if count < 1:
            count = 1
        level = request.data.get("level", "medium")
        raw_levels = request.data.get("levels")
        levels = None
        if isinstance(raw_levels, list):
            levels = [x for x in raw_levels if x in ("easy", "medium", "hard")]
            if not levels:
                levels = None
        # New student presets: easy | medium | advanced | challenge (ratio mixes)
        mix_key = (request.data.get("difficulty_mix") or "").strip()
        if mix_key not in DIFFICULTY_MIXES:
            # legacy: single level easy/medium/hard maps to same-named mix when present
            if level in DIFFICULTY_MIXES and not levels:
                mix_key = level
            else:
                mix_key = None
        review_mode = request.data.get("review_mode", Exam.ReviewMode.FINAL)
        if review_mode not in (Exam.ReviewMode.IMMEDIATE, Exam.ReviewMode.FINAL):
            review_mode = Exam.ReviewMode.FINAL
        question_pool = request.data.get("question_pool", "any")
        raw_limit = request.data.get("time_limit_minutes", None)
        try:
            time_limit = int(raw_limit) if raw_limit not in (None, "", 0, "0") else None
        except (TypeError, ValueError):
            time_limit = None
        if time_limit is not None and time_limit < 1:
            time_limit = None

        if not subject_ids:
            return Response(
                {"detail": "اختر مادة واحدةً على الأقل"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not lesson_ids:
            return Response(
                {"detail": "اختر درساً واحداً على الأقل"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Lessons must belong to the selected subjects.
        valid_lessons = set(
            Lesson.objects.filter(
                id__in=lesson_ids, subject_id__in=subject_ids, is_archived=False
            ).values_list("id", flat=True)
        )
        if set(lesson_ids) - valid_lessons:
            return Response(
                {"detail": "بعض الدروس لا تنتمي للمواد المختارة"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bank, group_ids, _ = _student_question_bank(user, subject_ids=subject_ids)
        bank = bank.filter(lesson_id__in=lesson_ids)
        if years:
            bank = bank.filter(question_year__in=years)
        if tiers:
            bank = bank.filter(teacher_tier__in=tiers)

        # Legacy multi-select of raw difficulties (teacher tools / old clients)
        if levels and not mix_key:
            bank = bank.filter(difficulty__in=levels)
            preset = levels[0] if len(levels) == 1 else ""
        elif mix_key:
            preset = mix_key if mix_key in ("easy", "medium", "hard") else ""
            # Keep full bank; ratios applied at pick time.
        elif level and level != "all" and level in ("easy", "medium", "hard"):
            bank = bank.filter(difficulty=level)
            preset = level
        else:
            preset = ""

        seen_ids = _seen_question_ids(user, subject_ids)
        if question_pool == "new":
            bank = bank.exclude(id__in=seen_ids)
        elif question_pool == "seen":
            bank = bank.filter(id__in=seen_ids)

        free = not user_has_full_content_access(user)
        if free:
            # Free tier: only first lesson of the first selected subject, capped.
            first = (
                Lesson.objects.filter(subject_id=subject_ids[0], is_archived=False)
                .order_by("order_number", "id")
                .first()
            )
            if first:
                bank = bank.filter(lesson_id=first.id)
            if first and any(int(x) != first.id for x in lesson_ids):
                return Response(
                    {
                        "detail": "المعاينة المجانية متاحة لأول درس فقط. تواصل مع الإدارة للتفعيل."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            limit = free_question_limit()
            pick_n = limit if take_all else min(count, limit)
            if mix_key:
                questions = _pick_mixed(bank, pick_n, mix_key)
            else:
                free_bank = bank.filter(free_order__isnull=False).order_by("free_order")
                questions = list(free_bank[:pick_n]) or _pick(bank, pick_n)
        elif take_all:
            if mix_key:
                questions = _pick_mixed(bank, None, mix_key)
            else:
                questions = _pick(bank, bank.count())
        else:
            if mix_key:
                questions = _pick_mixed(bank, count, mix_key)
            else:
                questions = _pick(bank, count)

        if not questions:
            if question_pool == "new":
                detail = "لا توجد أسئلة جديدة لم ترَها من قبل بهذه الإعدادات"
            elif question_pool == "seen":
                detail = "لا توجد أسئلة سابقة (مكررة) بهذه الإعدادات — جرّب «أسئلة جديدة» أو «الكل»"
            elif years:
                detail = "لا توجد أسئلة لهذه السنة/السنوات بهذه الإعدادات"
            elif tiers:
                detail = "لا توجد أسئلة بهذا الترشيح/الترشيحات بهذه الإعدادات"
            else:
                detail = "لا توجد أسئلة متاحة بهذه الإعدادات في بنك التجميعات"
            return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)

        title_override = (request.data.get("title") or "").strip()[:200]
        mix_labels = {
            "easy": "سهل",
            "medium": "متوسط",
            "advanced": "متقدم",
            "challenge": "تحدي",
        }
        if not title_override:
            if take_all and len(lesson_ids) == 1:
                lesson_row = (
                    Lesson.objects.filter(id=lesson_ids[0])
                    .select_related("subject")
                    .first()
                )
                if lesson_row:
                    title_override = (
                        f"تجميعات {lesson_row.subject.name} ( {lesson_row.title} )"
                    )
            elif len(subject_ids) > 1:
                title_override = "محاكي شخصي — عدة مواد"
            else:
                subj_name = (
                    Subject.objects.filter(id=subject_ids[0])
                    .values_list("name", flat=True)
                    .first()
                    or ""
                )
                title_override = f"محاكي شخصي — {subj_name}".strip(" —")
        if mix_key and mix_key in mix_labels and title_override:
            title_override = f"{title_override} · {mix_labels[mix_key]}"[:200]

        # Store mix name when it fits the CharField (advanced/challenge need blank or expanded)
        store_preset = preset
        if mix_key in ("easy", "medium", "hard"):
            store_preset = mix_key
        elif mix_key in ("advanced", "challenge"):
            store_preset = ""

        exam = Exam.objects.create(
            student=user,
            subject_id=subject_ids[0],
            group_id=group_ids[0] if group_ids else None,
            exam_type=Exam.Type.SIMULATOR,
            difficulty_preset=store_preset,
            review_mode=review_mode,
            question_count=len(questions),
            is_free_attempt=free,
            time_limit_minutes=time_limit,
            title_override=title_override,
        )
        ExamLesson.objects.bulk_create(
            [ExamLesson(exam=exam, lesson_id=lid) for lid in lesson_ids],
            ignore_conflicts=True,
        )
        ExamAnswer.objects.bulk_create(
            [
                ExamAnswer(exam=exam, question=q, order=i)
                for i, q in enumerate(questions)
            ]
        )

        return Response(_exam_payload(exam), status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def simulator_options(request):
    """
    Lessons + distinct question years for simulator / collections setup.
    Query: ?subjects=1&subjects=2  (or subjects=1,2)
    Optional: ?lessons=3&lessons=4 — narrow years/stats to those lessons.
    """
    from django.db.models import Count

    raw = request.query_params.getlist("subjects")
    if len(raw) == 1 and "," in raw[0]:
        raw = [x.strip() for x in raw[0].split(",") if x.strip()]
    subject_ids = []
    for x in raw:
        try:
            subject_ids.append(int(x))
        except (TypeError, ValueError):
            continue
    if not subject_ids:
        single = request.query_params.get("subject")
        if single:
            try:
                subject_ids = [int(single)]
            except (TypeError, ValueError):
                subject_ids = []
    if not subject_ids:
        return Response(
            {"detail": "subjects مطلوب"}, status=status.HTTP_400_BAD_REQUEST
        )

    raw_lessons = request.query_params.getlist("lessons")
    if len(raw_lessons) == 1 and "," in raw_lessons[0]:
        raw_lessons = [x.strip() for x in raw_lessons[0].split(",") if x.strip()]
    lesson_ids = []
    for x in raw_lessons:
        try:
            lesson_ids.append(int(x))
        except (TypeError, ValueError):
            continue

    lessons = list(
        Lesson.objects.filter(subject_id__in=subject_ids, is_archived=False)
        .select_related("subject")
        .order_by("subject_id", "order_number", "id")
        .values("id", "title", "order_number", "subject_id", "subject__name")
    )
    bank = CollectionQuestion.objects.filter(
        subject_id__in=subject_ids, needs_review=False
    )
    if lesson_ids:
        bank = bank.filter(lesson_id__in=lesson_ids)

    years = list(
        bank.exclude(question_year="")
        .values_list("question_year", flat=True)
        .distinct()
    )

    # Prefer numeric-looking years sorted desc, then other labels.
    def year_key(y):
        s = str(y).strip()
        digits = "".join(ch for ch in s if ch.isdigit())
        return (-int(digits) if digits else 0, s)

    years = sorted(set(years), key=year_key)

    # Per-year difficulty counts (for collections filters).
    year_stats = {}
    for row in (
        bank.exclude(question_year="")
        .values("question_year", "difficulty")
        .annotate(count=Count("id"))
    ):
        y = row["question_year"]
        bucket = year_stats.setdefault(
            y, {"year": y, "easy": 0, "medium": 0, "hard": 0, "total": 0}
        )
        diff = row["difficulty"]
        if diff in ("easy", "medium", "hard"):
            bucket[diff] = row["count"]
            bucket["total"] += row["count"]

    year_stats_list = sorted(year_stats.values(), key=lambda r: year_key(r["year"]))

    tier_order = {"gold": 0, "silver": 1, "bronze": 2}
    tier_labels = dict(CollectionQuestion.TeacherTier.choices)
    tier_stats = {}
    for row in bank.exclude(teacher_tier="").values("teacher_tier", "difficulty").annotate(
        count=Count("id")
    ):
        t = row["teacher_tier"]
        bucket = tier_stats.setdefault(
            t,
            {
                "tier": t,
                "label": tier_labels.get(t, t),
                "easy": 0,
                "medium": 0,
                "hard": 0,
                "total": 0,
            },
        )
        diff = row["difficulty"]
        if diff in ("easy", "medium", "hard"):
            bucket[diff] = row["count"]
            bucket["total"] += row["count"]
    tier_stats_list = sorted(tier_stats.values(), key=lambda r: tier_order.get(r["tier"], 9))

    filter_breakdown = [
        {
            "question_year": row["question_year"] or "",
            "teacher_tier": row["teacher_tier"] or "",
            "difficulty": row["difficulty"],
            "count": row["count"],
        }
        for row in bank.values("question_year", "teacher_tier", "difficulty").annotate(
            count=Count("id")
        )
    ]

    return Response(
        {
            "subjects": subject_ids,
            "lessons": [
                {
                    "id": row["id"],
                    "title": row["title"],
                    "order_number": row["order_number"],
                    "subject": row["subject_id"],
                    "subject_name": row["subject__name"],
                }
                for row in lessons
            ],
            "years": years,
            "year_stats": year_stats_list,
            "teacher_tiers": [r["tier"] for r in tier_stats_list],
            "tier_stats": tier_stats_list,
            "filter_breakdown": filter_breakdown,
        }
    )


class StartTeacherTestView(APIView):
    """
    Start a student attempt of a named teacher test (from تجميعات questions).

    Body: { "teacher_test": <id> }
    Legacy random mode still accepted: subject + count + preset + optional lesson.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        teacher_test_id = request.data.get("teacher_test")

        if teacher_test_id:
            return self._start_named(request, user, teacher_test_id)
        return self._start_legacy_random(request, user)

    def _start_named(self, request, user, teacher_test_id):
        tt = (
            TeacherTest.objects.filter(id=teacher_test_id, is_published=True)
            .prefetch_related("items__question", "lesson_links")
            .first()
        )
        if not tt:
            return Response(
                {"detail": "الاختبار غير موجود أو غير منشور"},
                status=status.HTTP_404_NOT_FOUND,
            )

        items = list(tt.items.select_related("question").order_by("order"))
        questions = [it.question for it in items]
        if not questions:
            return Response(
                {"detail": "لا توجد أسئلة في هذا الاختبار"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        free = not user_has_full_content_access(user)
        if free:
            questions = questions[: free_question_limit()]

        group_ids = _student_group_ids(user)
        exam = Exam.objects.create(
            student=user,
            subject_id=tt.subject_id,
            group_id=group_ids[0] if group_ids else None,
            exam_type=Exam.Type.TEACHER,
            review_mode=tt.review_mode,
            question_count=len(questions),
            is_free_attempt=free,
            title_override=tt.name,
            teacher_test=tt,
        )
        for link in tt.lesson_links.all():
            ExamLesson.objects.get_or_create(exam=exam, lesson_id=link.lesson_id)
        for i, q in enumerate(questions):
            ExamAnswer.objects.create(exam=exam, question=q, order=i)

        return Response(_exam_payload(exam), status=201)

    def _start_legacy_random(self, request, user):
        subject_id = request.data.get("subject")
        lesson_id = request.data.get("lesson")
        count = int(request.data.get("count", 20))
        preset = request.data.get("preset", "medium")
        review_mode = request.data.get("review_mode", "immediate")

        base, group_ids, _ = _student_question_bank(user, subject_id=subject_id)
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


class TeacherTestViewSet(viewsets.ViewSet):
    """
    Named teacher tests built from the global تجميعات bank.

    Teachers/admins: create, list own, delete, browse full question bank.
    Students: list published tests for a subject.
    """

    permission_classes = [IsAuthenticated]

    def list(self, request):
        subject_id = request.query_params.get("subject")
        user = request.user
        qs = TeacherTest.objects.select_related("created_by", "subject").all()
        if subject_id:
            qs = qs.filter(subject_id=subject_id)
        if user.is_admin_role:
            pass
        elif user.is_teacher:
            qs = qs.filter(Q(created_by=user) | Q(is_published=True))
        else:
            qs = qs.filter(is_published=True)
        return Response(TeacherTestSerializer(qs.order_by("-created_at", "-id"), many=True).data)

    def create(self, request):
        from core.access import assert_teacher_can_manage_subject
        from core.permissions import IsTeacherOrAdmin

        if not IsTeacherOrAdmin().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)

        ser = TeacherTestWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        user = request.user
        subject_id = data["subject"]
        assert_teacher_can_manage_subject(user, subject_id)

        lesson_ids = list(dict.fromkeys(data["lesson_ids"]))
        question_ids = list(dict.fromkeys(data["question_ids"]))

        lessons_ok = set(
            Lesson.objects.filter(subject_id=subject_id, id__in=lesson_ids).values_list(
                "id", flat=True
            )
        )
        if set(lesson_ids) - lessons_ok:
            return Response(
                {"detail": "بعض الدروس لا تنتمي لهذه المادة"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        questions = list(
            CollectionQuestion.objects.filter(
                subject_id=subject_id, id__in=question_ids, needs_review=False
            )
        )
        by_id = {q.id: q for q in questions}
        if len(by_id) != len(question_ids):
            return Response(
                {"detail": "بعض الأسئلة غير موجودة في بنك التجميعات لهذه المادة"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Prefer questions that belong to selected lessons
        for qid in question_ids:
            q = by_id[qid]
            if q.lesson_id not in lessons_ok:
                return Response(
                    {"detail": f"السؤال {qid} لا ينتمي للدروس المحددة"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        tt = TeacherTest.objects.create(
            name=data["name"].strip(),
            subject_id=subject_id,
            created_by=user,
            review_mode=data.get("review_mode") or Exam.ReviewMode.FINAL,
            is_published=data.get("is_published", True),
        )
        for lid in lesson_ids:
            TeacherTestLesson.objects.create(teacher_test=tt, lesson_id=lid)
        for i, qid in enumerate(question_ids):
            TeacherTestQuestion.objects.create(
                teacher_test=tt, question_id=qid, order=i
            )

        tt = TeacherTest.objects.prefetch_related(
            "lesson_links__lesson", "items", "created_by"
        ).get(id=tt.id)
        return Response(TeacherTestSerializer(tt).data, status=201)

    def destroy(self, request, pk=None):
        from core.permissions import IsTeacherOrAdmin

        if not IsTeacherOrAdmin().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)
        tt = TeacherTest.objects.filter(id=pk).first()
        if not tt:
            return Response(status=status.HTTP_404_NOT_FOUND)
        user = request.user
        if not user.is_admin_role and tt.created_by_id != user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        tt.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def question_bank(self, request):
        """All collection questions for selected lessons (any teacher) — for building a test."""
        from core.access import assert_teacher_can_manage_subject
        from core.permissions import IsTeacherOrAdmin

        if not IsTeacherOrAdmin().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)

        subject_id = request.query_params.get("subject")
        if not subject_id:
            return Response(
                {"detail": "subject مطلوب"}, status=status.HTTP_400_BAD_REQUEST
            )
        assert_teacher_can_manage_subject(request.user, subject_id)

        raw = request.query_params.get("lessons") or ""
        lesson_ids = [int(x) for x in raw.split(",") if x.strip().isdigit()]
        qs = CollectionQuestion.objects.filter(
            subject_id=subject_id, needs_review=False
        ).select_related("lesson")
        if lesson_ids:
            qs = qs.filter(lesson_id__in=lesson_ids)
        qs = qs.order_by("lesson__order_number", "difficulty", "id")

        rows = []
        for q in qs:
            rows.append(
                {
                    "id": q.id,
                    "lesson": q.lesson_id,
                    "lesson_title": q.lesson.title if q.lesson_id else "",
                    "difficulty": q.difficulty,
                    "text": q.text,
                    "text_image": q.text_image,
                    "options": q.options,
                    "correct_answer": q.correct_answer,
                    "video_bunny_id": q.video_bunny_id,
                }
            )
        return Response(rows)


def _exam_payload(exam):
    from django.db.models import Count, Q

    if not hasattr(exam, "_ann_correct"):
        stats = exam.answers.aggregate(
            _ann_correct=Count("id", filter=Q(is_correct=True)),
            _ann_wrong=Count("id", filter=Q(is_correct=False, skipped=False)),
        )
        exam._ann_correct = stats["_ann_correct"]
        exam._ann_wrong = stats["_ann_wrong"]

    answers = exam.answers.select_related(
        "question", "question__subject", "question__lesson"
    ).order_by("order")
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
        from django.db.models import Count, Q

        exam = (
            Exam.objects.filter(id=exam_id, student=request.user)
            .select_related("subject")
            .annotate(
                _ann_correct=Count("answers", filter=Q(answers__is_correct=True)),
                _ann_wrong=Count(
                    "answers",
                    filter=Q(answers__is_correct=False, answers__skipped=False),
                ),
            )
            .first()
        )
        if not exam:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(_exam_payload(exam))


class AnswerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, exam_id):
        exam = Exam.objects.filter(id=exam_id, student=request.user).only("id").first()
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
        ans.save(
            update_fields=["selected_answer", "skipped", "is_correct", "answered_at"]
        )

        q = ans.question
        video_after = (
            q.video_bunny_id
            if q.video_timing == q.VideoTiming.AFTER and q.video_bunny_id
            else ""
        )
        return Response(
            {
                "saved": True,
                "is_correct": ans.is_correct,
                "correct_answer": q.correct_answer,
                "written_correction": getattr(q, "written_correction", None)
                or getattr(q, "explanation", "")
                or "",
                "explanation_image": getattr(q, "explanation_image", "") or "",
                "video_bunny_id": video_after,
            }
        )


class FinishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, exam_id):
        exam = Exam.objects.filter(id=exam_id, student=request.user).first()
        if not exam:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if exam.status in (Exam.Status.FINISHED, Exam.Status.AUTO_SUBMITTED):
            return Response(ExamSerializer(exam).data)

        # Unanswered rows become skipped so they don't count as wrong answers.
        exam.answers.filter(Q(selected_answer="") | Q(selected_answer__isnull=True)).update(
            skipped=True,
            is_correct=False,
        )

        total = exam.answers.count()
        correct = exam.answers.filter(is_correct=True).count()
        exam.score_percent = round((correct / total) * 100, 1) if total else 0
        auto = bool(request.data.get("auto") or request.data.get("timed_out"))
        exam.status = Exam.Status.AUTO_SUBMITTED if auto else Exam.Status.FINISHED
        exam.finished_at = timezone.now()
        exam.save()
        return Response(ExamSerializer(exam).data)


class MyResultsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Q

        exams = (
            Exam.objects.filter(
                student=request.user, status__in=["finished", "auto_submitted"]
            )
            .select_related("subject")
            .annotate(
                _ann_correct=Count("answers", filter=Q(answers__is_correct=True)),
                _ann_wrong=Count(
                    "answers",
                    filter=Q(answers__is_correct=False, answers__skipped=False),
                ),
            )
            .order_by("-finished_at", "-id")
        )
        return Response(ExamSerializer(exams, many=True).data)


class ExamReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, exam_id):
        exam = Exam.objects.filter(id=exam_id, student=request.user).first()
        if not exam:
            return Response(status=status.HTTP_404_NOT_FOUND)
        answers = exam.answers.select_related(
            "question", "question__subject", "question__lesson"
        ).order_by("order")
        if request.query_params.get("filter") == "wrong":
            answers = answers.filter(is_correct=False, skipped=False).exclude(
                selected_answer=""
            )
        return Response(
            {
                "exam": ExamSerializer(exam).data,
                "answers": ExamAnswerReviewSerializer(answers, many=True).data,
            }
        )
