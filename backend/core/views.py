from django.conf import settings
from django.db import models
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from catalog.models import Lesson, Subject
from catalog.serializers import LessonSerializer, SubjectSerializer
from .models import VideoView
from .services import signed_embed_url


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def home_free_content(request):
    """Public: subjects + free-preview lessons shown to visitors on the home page."""
    subjects = Subject.objects.all()
    free_lessons = Lesson.objects.filter(is_free_preview=True, is_archived=False)
    return Response(
        {
            "subjects": SubjectSerializer(subjects, many=True).data,
            "free_lessons": LessonSerializer(free_lessons, many=True).data,
            "free_question_limit": settings.FREE_TIER_QUESTION_LIMIT,
        }
    )


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def video_token(request, bunny_id):
    """
    Returns a signed embed URL for a video, enforcing access:
    - First / free-preview lesson: anyone (visitors + non-activated accounts).
    - Any other video: authenticated teacher/admin, or student with active sub.
    """
    from core.access import lesson_is_free_preview, user_has_full_content_access

    lesson = (
        Lesson.objects.filter(bunny_video_id=bunny_id, is_archived=False)
        .order_by("order_number")
        .first()
    )
    is_free = lesson_is_free_preview(lesson) if lesson else False

    user = request.user if request.user.is_authenticated else None

    allowed = is_free or user_has_full_content_access(user)

    if not allowed:
        return Response(
            {"detail": "هذا الفيديو يتطلب تفعيل الحساب من الإدارة أو الاشتراك."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if user is not None:
        VideoView.objects.create(
            user=user,
            bunny_video_id=bunny_id,
            ip_address=_client_ip(request),
            device_fingerprint=request.headers.get("X-Device-Id", ""),
        )

    payload = signed_embed_url(bunny_id)
    payload["is_free"] = is_free
    return Response(payload)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def teacher_assignments(request):
    """(group, subject) pairs the current teacher is allowed to schedule for."""
    from groups.models import GroupTeacher

    user = request.user
    if user.is_admin_role:
        links = GroupTeacher.objects.all().select_related("group", "subject")
    elif user.is_teacher:
        links = GroupTeacher.objects.filter(teacher=user).select_related(
            "group", "subject"
        )
    else:
        return Response([])
    data = [
        {
            "group_id": l.group_id,
            "group_name": l.group.name,
            "subject_id": l.subject_id,
            "subject_name": l.subject.name,
        }
        for l in links
    ]
    return Response(data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def next_session(request):
    """
    The next upcoming live session, tailored to the current user (not a fixed
    banner for everyone):
    - Student: sessions for the groups they belong to.
    - Teacher: sessions they teach (plus the subjects they teach).
    - Admin: the nearest upcoming session overall.
    """
    from django.utils import timezone
    from scheduling.models import Session
    from scheduling.serializers import SessionSerializer
    from groups.models import GroupStudent, GroupTeacher

    user = request.user
    now = timezone.now()
    qs = Session.objects.filter(start_time__gte=now).select_related("subject")

    my_subjects = []
    if user.is_student:
        group_ids = list(
            GroupStudent.objects.filter(student=user).values_list("group_id", flat=True)
        )
        qs = qs.filter(group_id__in=group_ids)
    elif user.is_teacher:
        links = GroupTeacher.objects.filter(teacher=user).select_related("subject")
        my_subjects = sorted({l.subject.name for l in links})
        group_ids = list(links.values_list("group_id", flat=True))
        subject_ids = list(links.values_list("subject_id", flat=True))
        # Sessions this teacher runs, or scheduled for their groups/subjects.
        qs = qs.filter(
            models.Q(teacher=user)
            | models.Q(group_id__in=group_ids)
            | models.Q(subject_id__in=subject_ids)
        ).distinct()
    # admin: no extra filter — nearest overall

    session = qs.order_by("start_time").first()
    return Response(
        {
            "session": SessionSerializer(session).data if session else None,
            "teaches_subjects": my_subjects,
            "role": user.role,
        }
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def teacher_student_analytics(request, student_id):
    """
    Teacher view of one student, scoped server-side:
    - Teacher must share a group with the student.
    - Only the teacher's own subject(s) data is returned.
    Admins see everything.
    """
    from accounts.models import User
    from assessments.models import Exam
    from groups.models import GroupStudent, GroupTeacher

    user = request.user
    student = User.objects.filter(id=student_id, role=User.Role.STUDENT).first()
    if not student:
        return Response({"detail": "الطالب غير موجود"}, status=404)

    if user.is_admin_role:
        subject_ids = None  # all
    elif user.is_teacher:
        my_links = GroupTeacher.objects.filter(teacher=user)
        my_group_ids = set(my_links.values_list("group_id", flat=True))
        subject_ids = set(my_links.values_list("subject_id", flat=True))
        shared = GroupStudent.objects.filter(
            student=student, group_id__in=my_group_ids
        ).exists()
        if not shared:
            return Response(
                {"detail": "هذا الطالب ليس في مجموعاتك"}, status=403
            )
    else:
        return Response({"detail": "غير مصرح"}, status=403)

    exams = Exam.objects.filter(student=student, status__in=["finished", "auto_submitted"])
    if subject_ids is not None:
        exams = exams.filter(subject_id__in=subject_ids)

    exam_rows = []
    total_correct = total_wrong = 0
    for e in exams:
        c = e.answers.filter(is_correct=True).count()
        w = e.answers.filter(is_correct=False, skipped=False).count()
        total_correct += c
        total_wrong += w
        exam_rows.append(
            {
                "id": e.id,
                "title": e.title,
                "type": e.exam_type,
                "score_percent": e.score_percent,
                "correct": c,
                "wrong": w,
                "date": e.finished_at,
            }
        )

    return Response(
        {
            "student": {
                "id": student.id,
                "full_name": student.full_name,
                "phone": student.phone,
                "subscription_status": "active"
                if student.has_active_subscription
                else "expired",
                "last_login": student.last_login,
            },
            "totals": {
                "exams": len(exam_rows),
                "correct": total_correct,
                "wrong": total_wrong,
                "videos_watched": student.video_views.count(),
            },
            "exams": exam_rows,
        }
    )
