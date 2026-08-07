from django.db.models import Count, Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from core.permissions import IsAdmin, IsTeacherOrAdmin
from groups.models import GroupStudent, GroupTeacher
from .models import Session, SessionAttendance, sync_session_statuses
from .serializers import SessionSerializer


class SessionViewSet(viewsets.ModelViewSet):
    """
    Admin owns the timetable (create / edit schedule / delete).
    Teachers may only update zoom_link (and status) on their sessions.
    Attendance: teachers mark present/absent per session group roster.
    """

    queryset = Session.objects.select_related("subject", "group", "teacher").all()
    serializer_class = SessionSerializer
    pagination_class = None  # full schedule for numbering + past/upcoming views

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        if self.action == "attendance":
            if self.request.method in ("GET", "HEAD", "OPTIONS"):
                return [permissions.IsAuthenticated()]
            return [IsTeacherOrAdmin()]
        if self.action in ("create", "destroy"):
            return [IsAdmin()]
        # update / partial_update: admin full edit, teacher Zoom-only
        return [IsTeacherOrAdmin()]

    def _scoped_queryset(self):
        qs = Session.objects.select_related("subject", "group", "teacher").all()
        user = self.request.user
        if user.is_admin_role:
            return qs
        if user.is_teacher:
            links = GroupTeacher.objects.filter(teacher=user)
            group_ids = list(links.values_list("group_id", flat=True))
            qs = qs.filter(Q(teacher=user) | Q(group_id__in=group_ids)).distinct()
        else:
            group_ids = list(
                GroupStudent.objects.filter(student=user).values_list(
                    "group_id", flat=True
                )
            )
            qs = qs.filter(group_id__in=group_ids)
        return qs

    def get_queryset(self):
        # Close sessions whose duration has elapsed (fixes stuck «مباشر الآن»).
        sync_session_statuses(Session.objects.all())
        qs = self._scoped_queryset()
        when = (self.request.query_params.get("when") or "").strip().lower()
        if when == "past":
            return qs.filter(status=Session.Status.DONE).order_by(
                "-start_time", "-id"
            )
        if when == "upcoming":
            return qs.exclude(status=Session.Status.DONE).order_by(
                "start_time", "id"
            )
        return qs.order_by("start_time", "id")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        # Numbers span all sessions (past + upcoming) for the same subject/group.
        ctx["numbering_qs"] = self._scoped_queryset()
        user = self.request.user
        if user.is_authenticated and getattr(user, "is_student", False):
            ids = list(self.filter_queryset(self.get_queryset()).values_list("id", flat=True))
            rows = SessionAttendance.objects.filter(
                student=user, session_id__in=ids
            ).values_list("session_id", "status")
            ctx["my_attendance_map"] = {sid: st for sid, st in rows}
        elif user.is_authenticated and (user.is_teacher or user.is_admin_role):
            ids = list(self.filter_queryset(self.get_queryset()).values_list("id", flat=True))
            stats = (
                SessionAttendance.objects.filter(session_id__in=ids)
                .values("session_id")
                .annotate(
                    present=Count("id", filter=Q(status=SessionAttendance.Status.PRESENT)),
                    absent=Count("id", filter=Q(status=SessionAttendance.Status.ABSENT)),
                )
            )
            smap = {}
            for row in stats:
                total = row["present"] + row["absent"]
                smap[row["session_id"]] = {
                    "recorded": total > 0,
                    "present": row["present"],
                    "absent": row["absent"],
                    "total_marked": total,
                }
            ctx["attendance_summary_map"] = smap
        return ctx

    def _teacher_owns_session(self, session, user):
        if user.is_admin_role:
            return True
        if session.teacher_id == user.id:
            return True
        if session.group_id and session.subject_id:
            return GroupTeacher.objects.filter(
                teacher=user,
                group_id=session.group_id,
                subject_id=session.subject_id,
            ).exists()
        return False

    def _resolve_teacher(self, group, subject, explicit_teacher=None):
        if explicit_teacher is not None:
            return explicit_teacher, explicit_teacher.full_name
        if group and subject:
            link = (
                GroupTeacher.objects.filter(group=group, subject=subject)
                .select_related("teacher")
                .first()
            )
            if link:
                return link.teacher, link.teacher.full_name
        return None, ""

    def perform_create(self, serializer):
        if not self.request.user.is_admin_role:
            raise PermissionDenied("المدير فقط يضع جدول الحصص")
        group = serializer.validated_data.get("group")
        subject = serializer.validated_data.get("subject")
        if not group or not subject:
            raise PermissionDenied("لا بد من اختيار المجموعة والمادة")
        teacher, teacher_name = self._resolve_teacher(
            group, subject, serializer.validated_data.get("teacher")
        )
        serializer.save(teacher=teacher, teacher_name=teacher_name)

    def perform_update(self, serializer):
        user = self.request.user
        instance = self.get_object()

        if user.is_admin_role:
            group = serializer.validated_data.get("group", instance.group)
            subject = serializer.validated_data.get("subject", instance.subject)
            if "teacher" in serializer.validated_data:
                teacher = serializer.validated_data["teacher"]
                teacher_name = teacher.full_name if teacher else ""
            else:
                teacher, teacher_name = self._resolve_teacher(group, subject, None)
                if teacher is None:
                    teacher, teacher_name = instance.teacher, instance.teacher_name
            serializer.save(teacher=teacher, teacher_name=teacher_name or "")
            return

        # Teacher: Zoom (+ optional status) only on sessions they teach / are assigned to.
        if not self._teacher_owns_session(instance, user):
            raise PermissionDenied("يمكنك تعديل رابط Zoom لحصصك فقط")

        zoom = serializer.validated_data.get("zoom_link", instance.zoom_link)
        status_val = serializer.validated_data.get("status", instance.status)
        instance.zoom_link = zoom or ""
        instance.status = status_val
        instance.save(update_fields=["zoom_link", "status"])

    def perform_destroy(self, instance):
        if not self.request.user.is_admin_role:
            raise PermissionDenied("المدير فقط يحذف الحصص من الجدول")
        instance.delete()

    @action(detail=True, methods=["get", "put", "patch"])
    def attendance(self, request, pk=None):
        """
        GET: roster + marks (teacher/admin), or own mark (student).
        PUT/PATCH: bulk save marks — body { records: [{ student_id, status }] }
        """
        session = self.get_object()
        user = request.user

        if request.method == "GET":
            if user.is_student:
                row = SessionAttendance.objects.filter(
                    session=session, student=user
                ).first()
                return Response(
                    {
                        "session_id": session.id,
                        "my_attendance": row.status if row else None,
                    }
                )
            if not self._teacher_owns_session(session, user):
                raise PermissionDenied("غير مسموح بعرض حضور هذه الحصة")
            if not session.group_id:
                return Response(
                    {"detail": "هذه الحصة بلا مجموعة — لا يوجد طلاب لتسجيل الحضور"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(self._attendance_roster_payload(session))

        # PUT / PATCH — save marks
        if not self._teacher_owns_session(session, user):
            raise PermissionDenied("غير مسموح بتسجيل حضور هذه الحصة")
        if not session.group_id:
            raise ValidationError("هذه الحصة بلا مجموعة")

        payload = request.data.get("records")
        if not isinstance(payload, list):
            raise ValidationError({"records": "مطلوب قائمة سجلات الحضور"})

        allowed_ids = set(
            GroupStudent.objects.filter(group_id=session.group_id).values_list(
                "student_id", flat=True
            )
        )
        saved = 0
        for item in payload:
            try:
                student_id = int(item.get("student_id"))
            except (TypeError, ValueError, AttributeError):
                continue
            if student_id not in allowed_ids:
                continue
            st = item.get("status")
            if st not in (
                SessionAttendance.Status.PRESENT,
                SessionAttendance.Status.ABSENT,
                None,
                "",
            ):
                raise ValidationError(
                    {"status": "الحالة يجب أن تكون present أو absent"}
                )
            note = (item.get("note") or "")[:200]
            if not st:
                SessionAttendance.objects.filter(
                    session=session, student_id=student_id
                ).delete()
                continue
            SessionAttendance.objects.update_or_create(
                session=session,
                student_id=student_id,
                defaults={
                    "status": st,
                    "note": note,
                    "marked_by": user,
                },
            )
            saved += 1

        return Response(self._attendance_roster_payload(session))

    def _attendance_roster_payload(self, session):
        links = (
            GroupStudent.objects.filter(group_id=session.group_id)
            .select_related("student")
            .order_by("student__full_name", "student_id")
        )
        marks = {
            a.student_id: a
            for a in SessionAttendance.objects.filter(session=session)
        }
        records = []
        for link in links:
            mark = marks.get(link.student_id)
            records.append(
                {
                    "student_id": link.student_id,
                    "full_name": link.student.full_name,
                    "status": mark.status if mark else None,
                    "note": mark.note if mark else "",
                }
            )
        present = sum(1 for r in records if r["status"] == "present")
        absent = sum(1 for r in records if r["status"] == "absent")
        return {
            "session_id": session.id,
            "group_id": session.group_id,
            "group_name": session.group.name if session.group else "",
            "records": records,
            "summary": {
                "recorded": present + absent > 0,
                "present": present,
                "absent": absent,
                "unmarked": sum(1 for r in records if r["status"] is None),
                "total": len(records),
            },
        }
