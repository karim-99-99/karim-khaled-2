"""Parent link + report timeline APIs (Task 33)."""

from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import ParentReport, ParentTelegramLink, User
from accounts.parent_telegram import (
    ensure_parent_link_code,
    handle_bot_update,
    parent_link_url,
)
from core.permissions import IsAdmin, IsTeacherOrAdmin
from groups.models import GroupTeacher


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def my_parent_link(request):
    user = request.user
    if not user.is_student:
        return Response({"detail": "للطلاب فقط"}, status=403)
    code = ensure_parent_link_code(user)
    links = ParentTelegramLink.objects.filter(student=user, is_active=True)
    return Response(
        {
            "code": code,
            "url": parent_link_url(user),
            "linked_count": links.count(),
            "parents": [
                {
                    "id": p.id,
                    "display_name": p.display_name or p.telegram_username or p.chat_id,
                    "username": p.telegram_username,
                    "linked_at": p.linked_at.isoformat(),
                }
                for p in links
            ],
        }
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def telegram_bot_webhook(request):
    """Telegram Bot API webhook — /start {code}."""
    result = handle_bot_update(request.data if isinstance(request.data, dict) else {})
    return Response(result)


@api_view(["GET"])
@permission_classes([IsTeacherOrAdmin])
def student_parent_reports(request, student_id):
    """Timeline of parent reports for a student (scoped for teachers)."""
    user = request.user
    student = User.objects.filter(id=student_id, role=User.Role.STUDENT).first()
    if not student:
        return Response({"detail": "غير موجود"}, status=404)

    qs = ParentReport.objects.filter(student=student).select_related(
        "subject", "session", "created_by"
    )
    if user.is_teacher and not user.is_admin_role:
        subject_ids = list(
            GroupTeacher.objects.filter(teacher=user).values_list(
                "subject_id", flat=True
            )
        )
        group_ids = list(
            GroupTeacher.objects.filter(teacher=user).values_list(
                "group_id", flat=True
            )
        )
        from groups.models import GroupStudent

        if not GroupStudent.objects.filter(
            student=student, group_id__in=group_ids
        ).exists():
            return Response({"detail": "ليس من طلابك"}, status=403)
        qs = qs.filter(subject_id__in=subject_ids)

    subject = request.query_params.get("subject")
    if subject:
        qs = qs.filter(subject_id=subject)

    rows = []
    for r in qs[:100]:
        rows.append(
            {
                "id": r.id,
                "report_type": r.report_type,
                "status": r.status,
                "subject_id": r.subject_id,
                "subject_name": r.subject.name if r.subject_id else "",
                "session_id": r.session_id,
                "content_text": r.content_text,
                "sent_at": r.sent_at.isoformat() if r.sent_at else None,
                "created_at": r.created_at.isoformat(),
                "created_by_name": (
                    r.created_by.full_name if r.created_by_id else ""
                ),
            }
        )
    return Response(
        {
            "student": {"id": student.id, "full_name": student.full_name},
            "reports": rows,
            "parent_link": {
                "code": ensure_parent_link_code(student),
                "url": parent_link_url(student),
                "linked_count": ParentTelegramLink.objects.filter(
                    student=student, is_active=True
                ).count(),
            },
        }
    )


@api_view(["GET", "DELETE"])
@permission_classes([IsAdmin])
def admin_parent_link(request, student_id):
    student = User.objects.filter(id=student_id, role=User.Role.STUDENT).first()
    if not student:
        return Response({"detail": "غير موجود"}, status=404)
    if request.method == "GET":
        links = ParentTelegramLink.objects.filter(student=student)
        return Response(
            {
                "code": ensure_parent_link_code(student),
                "url": parent_link_url(student),
                "links": [
                    {
                        "id": p.id,
                        "chat_id": p.chat_id,
                        "display_name": p.display_name,
                        "username": p.telegram_username,
                        "is_active": p.is_active,
                        "linked_at": p.linked_at.isoformat(),
                    }
                    for p in links
                ],
            }
        )
    link_id = request.data.get("link_id") or request.query_params.get("link_id")
    ParentTelegramLink.objects.filter(student=student, id=link_id).update(
        is_active=False
    )
    return Response({"ok": True})
