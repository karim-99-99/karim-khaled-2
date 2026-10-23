from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from core.permissions import IsAdmin, IsTeacherOrAdmin
from groups.models import GroupStudent, GroupTeacher
from .bbb import BBBError, configured as bbb_configured, join_url, meeting_id_for
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
        if self.action in ("list", "retrieve", "join"):
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
            subject_ids = list(links.values_list("subject_id", flat=True))
            # Teacher sees only their subject(s) with their groups (or sessions assigned to them).
            qs = qs.filter(
                Q(teacher=user)
                | (Q(group_id__in=group_ids) & Q(subject_id__in=subject_ids))
            ).distinct()
        else:
            group_ids = list(
                GroupStudent.objects.filter(student=user).values_list(
                    "group_id", flat=True
                )
            )
            qs = qs.filter(group_id__in=group_ids)
        return qs

    def _when_filtered(self, qs):
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

    def _sync_open_sessions(self):
        # Close sessions whose duration has elapsed (fixes stuck «مباشر الآن»).
        now = timezone.now()
        sync_session_statuses(
            Session.objects.exclude(status=Session.Status.DONE).filter(
                Q(start_time__lte=now) | Q(status=Session.Status.LIVE)
            )
        )

    def get_queryset(self):
        self._sync_open_sessions()
        return self._when_filtered(self._scoped_queryset())

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        # Numbers span all sessions (past + upcoming) for the same subject/group.
        ctx["numbering_qs"] = self._scoped_queryset()
        user = self.request.user
        # Do NOT call get_queryset() here — that re-syncs and doubles DB work.
        page_ids = list(
            self.filter_queryset(self._when_filtered(self._scoped_queryset())).values_list(
                "id", flat=True
            )
        )
        if user.is_authenticated and getattr(user, "is_student", False):
            rows = SessionAttendance.objects.filter(
                student=user, session_id__in=page_ids
            ).values_list("session_id", "status")
            ctx["my_attendance_map"] = {sid: st for sid, st in rows}
        elif user.is_authenticated and (user.is_teacher or user.is_admin_role):
            stats = (
                SessionAttendance.objects.filter(session_id__in=page_ids)
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
        session = serializer.save(teacher=teacher, teacher_name=teacher_name)
        if not session.bbb_meeting_id:
            session.bbb_meeting_id = meeting_id_for(session.id)
            session.save(update_fields=["bbb_meeting_id"])

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
        joined = serializer.validated_data.get(
            "teacher_joined_zoom", instance.teacher_joined_zoom
        )
        instance.zoom_link = zoom or ""
        instance.status = status_val
        update_fields = ["zoom_link", "status"]
        if joined != instance.teacher_joined_zoom:
            instance.teacher_joined_zoom = bool(joined)
            instance.teacher_joined_zoom_at = (
                timezone.now() if instance.teacher_joined_zoom else None
            )
            update_fields.extend(["teacher_joined_zoom", "teacher_joined_zoom_at"])
        instance.save(update_fields=update_fields)

    def perform_destroy(self, instance):
        if not self.request.user.is_admin_role:
            raise PermissionDenied("المدير فقط يحذف الحصص من الجدول")
        instance.delete()

    def _can_join(self, session, user):
        if user.is_admin_role:
            return True, True
        if self._teacher_owns_session(session, user) and not user.is_student:
            return True, True
        if user.is_student and session.group_id:
            in_group = GroupStudent.objects.filter(
                group_id=session.group_id, student=user
            ).exists()
            if in_group:
                return True, False
        return False, False

    @action(detail=False, methods=["get"], permission_classes=[IsAdmin])
    def bbb_status(self, request):
        return Response({"configured": bbb_configured()})

    @action(detail=True, methods=["post"])
    def join(self, request, pk=None):
        """
        Admin arranges the row. This call creates the BBB meeting (if needed)
        and returns a personal join URL. The browser itself must open that
        URL; the server never calls join.
        """
        session = self.get_object()
        user = request.user
        allowed, moderator = self._can_join(session, user)
        if not allowed:
            raise PermissionDenied("هذه الحصة ليست لمجموعتك")

        now = timezone.now()
        if not user.is_admin_role:
            opens = session.start_time - timedelta(minutes=20)
            if now < opens:
                return Response(
                    {"detail": "لينك الدخول يتفتح قبل الحصة بـ ٢٠ دقيقة"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if now > session.end_time:
                return Response(
                    {"detail": "انتهت الحصة"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not bbb_configured():
            if session.zoom_link and not moderator:
                return Response({"url": session.zoom_link, "provider": "zoom"})
            if session.zoom_link and moderator:
                return Response({"url": session.zoom_link, "provider": "zoom"})
            return Response(
                {
                    "detail": "لايف BigBlueButton غير مربوط بعد. المدير يضع BBB_URL و BBB_SECRET."
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            url = join_url(
                session,
                full_name=user.full_name or user.email,
                user_id=user.id,
                moderator=moderator,
            )
        except BBBError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        if moderator and not user.is_student:
            session.teacher_joined_zoom = True
            session.teacher_joined_zoom_at = timezone.now()
            session.save(
                update_fields=["teacher_joined_zoom", "teacher_joined_zoom_at"]
            )
        return Response(
            SessionSerializer(session, context=self.get_serializer_context()).data
            | {"url": url, "provider": "bbb", "role": "moderator" if moderator else "viewer"}
        )

    @action(detail=True, methods=["post"])
    def teacher_zoom(self, request, pk=None):
        """Teacher marks that they joined (or left) the Zoom meeting."""
        session = self.get_object()
        user = request.user
        if user.is_student:
            raise PermissionDenied()
        if not user.is_admin_role and not self._teacher_owns_session(session, user):
            raise PermissionDenied("حصصك فقط")
        joined = request.data.get("joined")
        if joined is None:
            joined = True
        session.teacher_joined_zoom = bool(joined)
        session.teacher_joined_zoom_at = timezone.now() if session.teacher_joined_zoom else None
        session.save(update_fields=["teacher_joined_zoom", "teacher_joined_zoom_at"])
        return Response(SessionSerializer(session, context=self.get_serializer_context()).data)

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
