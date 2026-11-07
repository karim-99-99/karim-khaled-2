"""ملفات الأسئلة المهمة — حفظ ومراجعة أسئلة التجميعات لكل طالب."""

from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    MAX_QUESTION_FOLDERS,
    CollectionQuestion,
    Exam,
    ExamAnswer,
    ExamLesson,
    QuestionFolder,
    QuestionFolderItem,
)
from .views import _exam_payload


def _folder_qs(user):
    return QuestionFolder.objects.filter(student=user).annotate(
        question_count=Count("items", distinct=True),
        subject_count=Count("items__question__subject", distinct=True),
    )


def _folder_summary(folder):
    return {
        "id": folder.id,
        "name": folder.name,
        "question_count": getattr(folder, "question_count", folder.items.count()),
        "subject_count": getattr(
            folder,
            "subject_count",
            folder.items.values("question__subject").distinct().count(),
        ),
        "created_at": folder.created_at,
        "updated_at": folder.updated_at,
        "max_folders": MAX_QUESTION_FOLDERS,
    }


def _grouped_by_subject(folder):
    items = folder.items.select_related(
        "question", "question__subject", "question__lesson"
    ).order_by("question__subject__order", "question__subject_id", "-added_at", "-id")
    groups = {}
    order = []
    for item in items:
        q = item.question
        sid = q.subject_id
        if sid not in groups:
            groups[sid] = {
                "subject": sid,
                "subject_name": q.subject.name if q.subject_id else "",
                "questions": [],
            }
            order.append(sid)
        groups[sid]["questions"].append(
            {
                "item_id": item.id,
                "question_id": q.id,
                "added_at": item.added_at,
                "difficulty": q.difficulty,
                "question_year": q.question_year,
                "text": q.text,
                "text_image": q.text_image or "",
            }
        )
    return [groups[sid] for sid in order]


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def question_folders(request):
    """GET: قائمة الملفات · POST: إنشاء ملف (حد أقصى 20)."""
    if request.method == "GET":
        rows = [_folder_summary(f) for f in _folder_qs(request.user)]
        return Response(
            {
                "results": rows,
                "max_folders": MAX_QUESTION_FOLDERS,
                "remaining": max(0, MAX_QUESTION_FOLDERS - len(rows)),
            }
        )

    name = (request.data.get("name") or "").strip()
    if not name:
        return Response({"detail": "اكتب اسم الملف"}, status=400)
    if len(name) > 80:
        return Response({"detail": "الاسم طويل جداً"}, status=400)

    current = QuestionFolder.objects.filter(student=request.user).count()
    if current >= MAX_QUESTION_FOLDERS:
        return Response(
            {"detail": f"الحد الأقصى {MAX_QUESTION_FOLDERS} ملف — احذف ملفاً أولاً"},
            status=400,
        )
    if QuestionFolder.objects.filter(student=request.user, name=name).exists():
        return Response({"detail": "عندك ملف بنفس الاسم"}, status=400)

    folder = QuestionFolder.objects.create(student=request.user, name=name)
    folder = _folder_qs(request.user).get(id=folder.id)
    return Response(_folder_summary(folder), status=201)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def question_folder_detail(request, folder_id):
    folder = _folder_qs(request.user).filter(id=folder_id).first()
    if not folder:
        return Response({"detail": "الملف غير موجود"}, status=404)

    if request.method == "GET":
        out = _folder_summary(folder)
        out["subjects"] = _grouped_by_subject(folder)
        return Response(out)

    if request.method == "DELETE":
        folder.delete()
        return Response(status=204)

    name = (request.data.get("name") or "").strip()
    if not name:
        return Response({"detail": "اكتب اسم الملف"}, status=400)
    if (
        QuestionFolder.objects.filter(student=request.user, name=name)
        .exclude(id=folder.id)
        .exists()
    ):
        return Response({"detail": "عندك ملف بنفس الاسم"}, status=400)
    folder.name = name[:80]
    folder.save(update_fields=["name", "updated_at"])
    folder = _folder_qs(request.user).get(id=folder.id)
    return Response(_folder_summary(folder))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def question_folder_add_item(request, folder_id):
    folder = QuestionFolder.objects.filter(id=folder_id, student=request.user).first()
    if not folder:
        return Response({"detail": "الملف غير موجود"}, status=404)
    try:
        qid = int(request.data.get("question_id"))
    except (TypeError, ValueError):
        return Response({"detail": "question_id غير صالح"}, status=400)
    question = CollectionQuestion.objects.filter(id=qid, needs_review=False).first()
    if not question:
        return Response({"detail": "السؤال غير موجود"}, status=404)

    item, created = QuestionFolderItem.objects.get_or_create(
        folder=folder, question=question
    )
    folder.updated_at = timezone.now()
    folder.save(update_fields=["updated_at"])
    return Response(
        {
            "saved": True,
            "created": created,
            "item_id": item.id,
            "folder_id": folder.id,
            "folder_name": folder.name,
            "question_id": question.id,
            "subject": question.subject_id,
        },
        status=201 if created else 200,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def question_folder_remove_item(request, folder_id, question_id):
    folder = QuestionFolder.objects.filter(id=folder_id, student=request.user).first()
    if not folder:
        return Response({"detail": "الملف غير موجود"}, status=404)
    deleted, _ = QuestionFolderItem.objects.filter(
        folder=folder, question_id=question_id
    ).delete()
    if deleted:
        folder.updated_at = timezone.now()
        folder.save(update_fields=["updated_at"])
    return Response({"removed": bool(deleted)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def question_folder_membership(request):
    """أي ملفات تحتوي هذا السؤال؟ ?question=<id>"""
    try:
        qid = int(request.query_params.get("question"))
    except (TypeError, ValueError):
        return Response({"detail": "question مطلوب"}, status=400)
    folder_ids = list(
        QuestionFolderItem.objects.filter(
            folder__student=request.user, question_id=qid
        ).values_list("folder_id", flat=True)
    )
    folders = list(
        QuestionFolder.objects.filter(student=request.user)
        .annotate(question_count=Count("items", distinct=True))
        .order_by("-updated_at")
    )
    return Response(
        {
            "question_id": qid,
            "folder_ids": folder_ids,
            "folders": [
                {
                    "id": f.id,
                    "name": f.name,
                    "question_count": f.question_count,
                    "contains": f.id in folder_ids,
                }
                for f in folders
            ],
            "remaining_slots": max(0, MAX_QUESTION_FOLDERS - len(folders)),
            "max_folders": MAX_QUESTION_FOLDERS,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def question_folder_practice(request, folder_id):
    """
    ابدأ تمريناً من أسئلة الملف.
    Body اختياري: { subject_id, review_mode }
    """
    folder = QuestionFolder.objects.filter(id=folder_id, student=request.user).first()
    if not folder:
        return Response({"detail": "الملف غير موجود"}, status=404)

    subject_id = request.data.get("subject_id")
    review_mode = request.data.get("review_mode") or Exam.ReviewMode.IMMEDIATE
    if review_mode not in (
        Exam.ReviewMode.IMMEDIATE,
        Exam.ReviewMode.FINAL,
        "immediate",
        "final",
    ):
        review_mode = Exam.ReviewMode.IMMEDIATE

    qs = CollectionQuestion.objects.filter(
        folder_items__folder=folder, needs_review=False
    ).select_related("subject", "lesson")
    if subject_id:
        try:
            qs = qs.filter(subject_id=int(subject_id))
        except (TypeError, ValueError):
            return Response({"detail": "subject_id غير صالح"}, status=400)

    questions = list(qs.order_by("subject__order", "subject_id", "id").distinct())
    if not questions:
        return Response({"detail": "لا توجد أسئلة في هذا الملف"}, status=400)

    # Exam.subject is required — use filter subject or first question's subject.
    primary_subject_id = (
        int(subject_id)
        if subject_id
        else questions[0].subject_id
    )
    title = f"{folder.name}"
    if subject_id:
        title = f"{folder.name} — {questions[0].subject.name}"
    title = title[:200]

    with transaction.atomic():
        exam = Exam.objects.create(
            student=request.user,
            subject_id=primary_subject_id,
            exam_type=Exam.Type.SIMULATOR,
            review_mode=review_mode,
            question_count=len(questions),
            title_override=title,
        )
        lesson_ids = sorted({q.lesson_id for q in questions if q.lesson_id})
        if lesson_ids:
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
