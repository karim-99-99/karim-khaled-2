from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from core.permissions import IsAdmin, IsTeacherOrAdmin
from groups.models import GroupStudent, GroupTeacher
from .bbb import BBBError, configured as bbb_configured, join_url, meeting_id_for
from .models import Session, SessionAttendance, TeacherAvailability, sync_session_statuses
from .serializers import SessionSerializer, TeacherAvailabilitySerializer


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

    def list(self, request, *args, **kwargs):
        from core.plans import assert_gold_feature

        if getattr(request.user, "is_student", False):
            assert_gold_feature(request.user, "جدول الحصص")
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        from core.plans import assert_gold_feature

        if getattr(request.user, "is_student", False):
            assert_gold_feature(request.user, "جدول الحصص")
        return super().retrieve(request, *args, **kwargs)

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
        from core.plans import assert_gold_feature

        from core.time_rules import class_state, teacher_joined

        user = request.user
        if getattr(user, "is_student", False):
            assert_gold_feature(user, "الحصص المباشرة")
        session = self.get_object()
        allowed, moderator = self._can_join(session, user)
        if not allowed:
            raise PermissionDenied("هذه الحصة ليست لمجموعتك")

        now = timezone.now()
        if getattr(user, "is_student", False):
            # Students may join only after the teacher has entered (Task 15).
            state = class_state(session, now)
            if state == "ended" or now > session.end_time:
                return Response(
                    {"detail": "انتهت الحصة"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not teacher_joined(session):
                raise PermissionDenied(
                    "لا يمكن دخول الحصة قبل دخول المدرس. انتظر «مباشر الآن»."
                )
        elif not user.is_admin_role:
            opens = session.start_time - timedelta(minutes=10)
            if now < opens:
                return Response(
                    {"detail": "لينك الدخول يتفتح قبل الحصة بـ ١٠ دقائق"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if now > session.end_time:
                return Response(
                    {"detail": "انتهت الحصة"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not bbb_configured():
            if session.zoom_link and not moderator:
                url = session.zoom_link
                provider = "zoom"
            elif session.zoom_link and moderator:
                url = session.zoom_link
                provider = "zoom"
            else:
                return Response(
                    {
                        "detail": "لايف BigBlueButton غير مربوط بعد. المدير يضع BBB_URL و BBB_SECRET."
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
        else:
            try:
                url = join_url(
                    session,
                    full_name=user.full_name or user.email,
                    user_id=user.id,
                    moderator=moderator,
                )
                provider = "bbb"
            except BBBError as exc:
                return Response(
                    {"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY
                )

        if moderator and not user.is_student:
            session.teacher_joined_zoom = True
            session.teacher_joined_zoom_at = timezone.now()
            session.save(
                update_fields=["teacher_joined_zoom", "teacher_joined_zoom_at"]
            )

        if getattr(user, "is_student", False):
            # Auto-present on first join; keep earliest joined_at (Task 15).
            row, created = SessionAttendance.objects.get_or_create(
                session=session,
                student=user,
                defaults={
                    "status": SessionAttendance.Status.PRESENT,
                    "status_source": SessionAttendance.StatusSource.AUTO,
                    "joined_at": now,
                },
            )
            if not created:
                updates = []
                if row.status != SessionAttendance.Status.PRESENT and (
                    row.status_source != SessionAttendance.StatusSource.TEACHER
                ):
                    row.status = SessionAttendance.Status.PRESENT
                    row.status_source = SessionAttendance.StatusSource.AUTO
                    updates.extend(["status", "status_source"])
                if row.joined_at is None:
                    row.joined_at = now
                    updates.append("joined_at")
                if updates:
                    row.save(update_fields=updates)

        return Response(
            SessionSerializer(session, context=self.get_serializer_context()).data
            | {
                "url": url,
                "provider": provider,
                "role": "moderator" if moderator else "viewer",
            }
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
                    "status_source": SessionAttendance.StatusSource.TEACHER,
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


@api_view(["GET", "PUT"])
@permission_classes([IsTeacherOrAdmin])
def teacher_availability(request):
    """
    GET: list my weekly availability slots.
    PUT: replace all slots with body { slots: [{weekday, start_time, end_time}, ...] }
    """
    teacher = request.user
    if request.method == "GET":
        rows = TeacherAvailability.objects.filter(teacher=teacher)
        return Response(TeacherAvailabilitySerializer(rows, many=True).data)

    slots = request.data.get("slots")
    if not isinstance(slots, list):
        return Response({"detail": "slots يجب أن تكون قائمة"}, status=400)

    ser = TeacherAvailabilitySerializer(data=slots, many=True)
    ser.is_valid(raise_exception=True)
    # Merge overlapping / adjacent windows per weekday before save (Task 29).
    by_day = {}
    for item in ser.validated_data:
        by_day.setdefault(item["weekday"], []).append(dict(item))
    merged = []
    for weekday, items in by_day.items():
        items = sorted(items, key=lambda x: x["start_time"])
        cur = None
        for item in items:
            if cur is None:
                cur = {
                    "weekday": weekday,
                    "start_time": item["start_time"],
                    "end_time": item["end_time"],
                }
                continue
            if item["start_time"] <= cur["end_time"]:
                if item["end_time"] > cur["end_time"]:
                    cur["end_time"] = item["end_time"]
            else:
                merged.append(cur)
                cur = {
                    "weekday": weekday,
                    "start_time": item["start_time"],
                    "end_time": item["end_time"],
                }
        if cur:
            merged.append(cur)

    # Warn (but still save) if future sessions fall outside the new windows
    from core.time_rules import to_riyadh

    warning = None
    conflict_count = 0
    future = Session.objects.filter(
        teacher=teacher, start_time__gte=timezone.now()
    ).exclude(status=Session.Status.DONE)
    for sess in future:
        local = to_riyadh(sess.start_time)
        if local is None:
            continue
        end_local = to_riyadh(sess.end_time) or local
        st = local.time().replace(second=0, microsecond=0)
        et = end_local.time().replace(second=0, microsecond=0)
        covered = any(
            m["weekday"] == local.weekday()
            and m["start_time"] <= st
            and m["end_time"] >= et
            for m in merged
        )
        if not covered:
            conflict_count += 1
    if conflict_count:
        warning = (
            f"في {conflict_count} حصص متحددة في الفترة دي، كلّم الإدارة. "
            "الحصص ما اتمسحتش."
        )

    with transaction.atomic():
        TeacherAvailability.objects.filter(teacher=teacher).delete()
        created = [
            TeacherAvailability(teacher=teacher, **item) for item in merged
        ]
        TeacherAvailability.objects.bulk_create(created)
    rows = TeacherAvailability.objects.filter(teacher=teacher)
    return Response(
        {
            "slots": TeacherAvailabilitySerializer(rows, many=True).data,
            "warning": warning,
        }
    )


@api_view(["GET"])
@permission_classes([IsTeacherOrAdmin])
def teacher_home(request):
    """Teacher dashboard (Task 27 / B1) — scoped to HIS groups/subjects."""
    from .teacher_home import build_teacher_home

    return Response(build_teacher_home(request.user))


@api_view(["GET"])
@permission_classes([IsTeacherOrAdmin])
def teacher_classes(request):
    """Teacher «حصصي» schedule + past (Task 28 / B2.1)."""
    from .teacher_classes import build_teacher_classes

    return Response(
        build_teacher_classes(
            request.user,
            group_id=request.query_params.get("group"),
            selected_date=request.query_params.get("date"),
            past_month=request.query_params.get("month"),
        )
    )


@api_view(["POST"])
@permission_classes([IsTeacherOrAdmin])
def teacher_remind_student(request, student_id):
    """Reminder to parent via Telegram (Task 33) — max once / 24h / subject."""
    from accounts.models import User
    from accounts.parent_telegram import send_task_reminder
    from catalog.models import Subject
    from groups.models import GroupStudent

    user = request.user
    if not user.is_admin_role:
        group_ids = GroupTeacher.objects.filter(teacher=user).values_list(
            "group_id", flat=True
        )
        ok = GroupStudent.objects.filter(
            student_id=student_id, group_id__in=group_ids
        ).exists()
        if not ok:
            raise PermissionDenied("هذا الطالب ليس في مجموعاتك")

    student = User.objects.filter(id=student_id, role=User.Role.STUDENT).first()
    if not student:
        return Response({"detail": "طالب غير موجود"}, status=404)

    subject_id = request.data.get("subject_id") or getattr(user, "taught_subject_id", None)
    if not subject_id:
        link = GroupTeacher.objects.filter(teacher=user).select_related("subject").first()
        subject_id = link.subject_id if link else None
    subject = Subject.objects.filter(id=subject_id).first() if subject_id else None
    if not subject:
        return Response({"detail": "المادة مطلوبة"}, status=400)

    titles = request.data.get("task_titles") or []
    if not isinstance(titles, list):
        titles = []
    if not titles:
        # Best-effort: late tasks from daily-tasks style current list
        try:
            from core.time_rules import released_tasks_for_student

            tasks = released_tasks_for_student(student, current_only=True)
            titles = [
                t.get("title")
                for t in tasks
                if t.get("subject_id") == subject.id and not t.get("is_done")
            ]
        except Exception:
            titles = []
    if not titles:
        titles = ["مهام يومية متأخرة"]

    result = send_task_reminder(
        teacher=user, student=student, subject=subject, task_titles=titles
    )
    if result.get("reason") == "cooldown":
        return Response(result, status=status.HTTP_429_TOO_MANY_REQUESTS)
    return Response(result)


@api_view(["GET", "PUT", "POST"])
@permission_classes([IsTeacherOrAdmin])
def session_rate(request, pk):
    """GET / PUT draft / POST save (+ optional resend) for class rating (Task 30)."""
    from scheduling.class_rating import (
        _teacher_owns,
        build_rate_payload,
        save_rate_payload,
    )
    from accounts.parent_telegram import deliver_class_reports
    from scheduling.models import ClassRating

    session = (
        Session.objects.select_related("subject", "group", "teacher")
        .filter(pk=pk)
        .first()
    )
    if not session:
        return Response({"detail": "الحصة غير موجودة"}, status=404)
    if not _teacher_owns(session, request.user):
        raise PermissionDenied("ليست من حصصك")

    if request.method == "GET":
        return Response(build_rate_payload(session, request.user))

    if request.method == "PUT":
        payload, meta = save_rate_payload(
            session, request.user, request.data, as_draft=True
        )
        return Response({**payload, "meta": meta})

    # POST = save (or resend)
    if request.data.get("resend_only"):
        rating = ClassRating.objects.filter(session=session).first()
        if not rating or rating.status != ClassRating.Status.SAVED:
            return Response(
                {"detail": "احفظ التقييم أولاً قبل إعادة الإرسال"}, status=400
            )
        delivery = deliver_class_reports(
            session, class_rating=rating, created_by=request.user, force=True
        )
        payload = build_rate_payload(session, request.user)
        payload["delivery"] = delivery
        return Response(payload)

    # Save sync; Telegram delivery can be forced resend via resend_only.
    # Primary save still delivers, but do it off the request thread when possible.
    payload, delivery = save_rate_payload(
        session, request.user, request.data, as_draft=False
    )
    return Response(payload)
