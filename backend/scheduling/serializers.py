from datetime import timedelta

from django.db.models import Count, Q
from rest_framework import serializers

from .models import Session, SessionAttendance, TeacherAvailability


class SessionSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    subject_theme_key = serializers.SerializerMethodField()
    group_name = serializers.CharField(source="group.name", read_only=True, default="")
    display_title = serializers.CharField(read_only=True)
    session_number = serializers.SerializerMethodField()
    my_attendance = serializers.SerializerMethodField()
    attendance_summary = serializers.SerializerMethodField()
    bbb_configured = serializers.SerializerMethodField()
    join_mode = serializers.SerializerMethodField()
    is_extra = serializers.BooleanField(read_only=True)
    lesson_title = serializers.CharField(source="lesson.title", read_only=True, default="")

    class Meta:
        model = Session
        fields = [
            "id",
            "title",
            "title_override",
            "session_type",
            "display_title",
            "is_extra",
            "subject",
            "subject_name",
            "subject_theme_key",
            "lesson",
            "lesson_title",
            "group",
            "group_name",
            "teacher",
            "teacher_name",
            "start_time",
            "duration_minutes",
            "zoom_link",
            "bbb_meeting_id",
            "bbb_configured",
            "join_mode",
            "teacher_joined_zoom",
            "teacher_joined_zoom_at",
            "status",
            "session_number",
            "my_attendance",
            "attendance_summary",
        ]
        read_only_fields = [
            "id",
            "display_title",
            "is_extra",
            "subject_name",
            "subject_theme_key",
            "lesson_title",
            "group_name",
            "teacher_name",
            "session_number",
            "my_attendance",
            "attendance_summary",
            "teacher_joined_zoom",
            "teacher_joined_zoom_at",
            "bbb_meeting_id",
            "bbb_configured",
            "join_mode",
        ]

    def get_subject_theme_key(self, obj):
        subject = getattr(obj, "subject", None)
        return getattr(subject, "theme_key", "") or ""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        name = data.get("teacher_name")
        if not (isinstance(name, str) and name.strip()) and getattr(instance, "teacher_id", None):
            teacher = getattr(instance, "teacher", None)
            full_name = getattr(teacher, "full_name", "") if teacher else ""
            if isinstance(full_name, str) and full_name.strip():
                data["teacher_name"] = full_name.strip()
        return data

    def _build_session_numbers(self):
        """Number sessions chronologically within each subject (+ group)."""
        cache = self.context.get("_session_numbers")
        if cache is not None:
            return cache
        cache = {}
        qs = self.context.get("numbering_qs")
        if qs is None:
            self.context["_session_numbers"] = cache
            return cache
        # Number foundation classes only — extras keep a badge, not a foundation index.
        rows = (
            qs.filter(session_type=Session.SessionType.FOUNDATION)
            .order_by("start_time", "id")
            .values_list("id", "subject_id", "group_id")
        )
        counters = {}
        for sid, subject_id, group_id in rows:
            key = (subject_id, group_id)
            counters[key] = counters.get(key, 0) + 1
            cache[sid] = counters[key]
        self.context["_session_numbers"] = cache
        return cache

    def get_bbb_configured(self, obj):
        from .bbb import configured

        return configured()

    def get_join_mode(self, obj):
        from .bbb import configured

        if configured() or obj.bbb_meeting_id:
            return "bbb"
        if obj.zoom_link:
            return "zoom"
        return "none"

    def get_session_number(self, obj):
        if getattr(obj, "session_type", None) == Session.SessionType.EXTRA:
            return None
        cache = self._build_session_numbers()
        if obj.id in cache:
            return cache[obj.id]
        earlier = Session.objects.filter(
            subject_id=obj.subject_id, session_type=Session.SessionType.FOUNDATION
        )
        if obj.group_id:
            earlier = earlier.filter(group_id=obj.group_id)
        else:
            earlier = earlier.filter(group_id__isnull=True)
        return earlier.filter(
            Q(start_time__lt=obj.start_time)
            | Q(start_time=obj.start_time, id__lte=obj.id)
        ).count()

    def get_my_attendance(self, obj):
        """Student's own present/absent status (null if not marked)."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or not getattr(user, "is_student", False):
            return None
        amap = self.context.get("my_attendance_map")
        if amap is not None:
            return amap.get(obj.id)
        row = SessionAttendance.objects.filter(session=obj, student=user).first()
        return row.status if row else None

    def get_attendance_summary(self, obj):
        """Teacher/admin quick counts; students get null."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None
        if not (user.is_teacher or user.is_admin_role):
            return None
        smap = self.context.get("attendance_summary_map")
        if smap is not None:
            return smap.get(
                obj.id,
                {"recorded": False, "present": 0, "absent": 0, "total_marked": 0},
            )
        present = obj.attendances.filter(status=SessionAttendance.Status.PRESENT).count()
        absent = obj.attendances.filter(status=SessionAttendance.Status.ABSENT).count()
        total = present + absent
        return {
            "recorded": total > 0,
            "present": present,
            "absent": absent,
            "total_marked": total,
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return
        # Teachers may only write Zoom (+ status + Zoom presence); schedule fields stay read-only.
        if user.is_teacher and not user.is_admin_role:
            for name in (
                "title",
                "title_override",
                "session_type",
                "lesson",
                "subject",
                "group",
                "teacher",
                "start_time",
                "duration_minutes",
            ):
                if name in self.fields:
                    self.fields[name].read_only = True
            if "teacher_joined_zoom" in self.fields:
                self.fields["teacher_joined_zoom"].read_only = False

    def validate(self, attrs):
        """Reject overlapping sessions for the same teacher or group (admin may confirm)."""
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        duration = (
            attrs.get(
                "duration_minutes", getattr(self.instance, "duration_minutes", 60)
            )
            or 60
        )
        teacher = attrs.get("teacher", getattr(self.instance, "teacher", None))
        group = attrs.get("group", getattr(self.instance, "group", None))
        session_type = attrs.get(
            "session_type", getattr(self.instance, "session_type", Session.SessionType.FOUNDATION)
        )
        title_override = attrs.get(
            "title_override", getattr(self.instance, "title_override", "")
        )
        if session_type == Session.SessionType.EXTRA and not (title_override or "").strip():
            raise serializers.ValidationError(
                {"title_override": "عنوان الحصة الإضافية مطلوب (يكتبه المدير)."}
            )
        if not start:
            return attrs
        end = start + timedelta(minutes=duration)
        qs = Session.objects.all()
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        window_start = start - timedelta(hours=6)
        window_end = end + timedelta(hours=6)
        candidates = qs.filter(
            start_time__gte=window_start, start_time__lte=window_end
        )
        teacher_id = getattr(teacher, "id", teacher) if teacher else None
        group_id = getattr(group, "id", group) if group else None
        request = self.context.get("request")
        confirm_overlap = False
        if request is not None:
            raw = request.data.get("confirm_overlap")
            confirm_overlap = raw in (True, "true", "1", 1)
            if confirm_overlap and not getattr(request.user, "is_admin_role", False):
                confirm_overlap = False
        for row in candidates:
            row_end = row.start_time + timedelta(minutes=row.duration_minutes or 60)
            if not (row.start_time < end and row_end > start):
                continue
            label = (
                (row.title_override or "").strip()
                or (row.title or "").strip()
                or (row.subject.name if row.subject_id else "")
                or f"#{row.id}"
            )
            if teacher_id and row.teacher_id == teacher_id:
                msg = (
                    f"تحذير: تعارض موعد مع حصة «{label}» لنفس المدرس "
                    f"({row.start_time.strftime('%Y-%m-%d %H:%M')})."
                )
                if confirm_overlap:
                    continue
                raise serializers.ValidationError({"start_time": msg})
            if group_id and row.group_id == group_id:
                msg = (
                    f"تحذير: تعارض موعد مع حصة «{label}» لنفس المجموعة "
                    f"({row.start_time.strftime('%Y-%m-%d %H:%M')}). "
                    "أعد الإرسال مع confirm_overlap=true إن أردت المتابعة."
                )
                if confirm_overlap:
                    continue
                raise serializers.ValidationError({"start_time": msg})

        # Session must sit entirely inside one teacher availability window (Task 29).
        if teacher_id:
            from core.time_rules import to_riyadh

            local_start = to_riyadh(start) or start
            local_end = to_riyadh(end) or end
            weekday = local_start.weekday()
            st = local_start.time().replace(second=0, microsecond=0)
            et = local_end.time().replace(second=0, microsecond=0)
            slots = list(
                TeacherAvailability.objects.filter(
                    teacher_id=teacher_id, weekday=weekday
                ).order_by("start_time")
            )
            day_names = (
                "الاثنين",
                "الثلاثاء",
                "الأربعاء",
                "الخميس",
                "الجمعة",
                "السبت",
                "الأحد",
            )
            day_label = day_names[weekday]

            def _fmt(t):
                h, m = t.hour, t.minute
                suffix = "ص" if h < 12 else "م"
                h12 = h % 12 or 12
                return f"{h12}:{m:02d} {suffix}"

            if not slots:
                # No windows at all → admin cannot place any class for this teacher.
                any_slots = TeacherAvailability.objects.filter(
                    teacher_id=teacher_id
                ).exists()
                if not any_slots:
                    raise serializers.ValidationError(
                        {
                            "start_time": (
                                "المدرس مش متاح في الوقت ده · "
                                "ما عندوش مواعيد متاحة محفوظة. خلّيه يحدّد مواعيده أولاً."
                            )
                        }
                    )
                raise serializers.ValidationError(
                    {
                        "start_time": (
                            f"المدرس مش متاح في الوقت ده · مفيش فترات يوم {day_label}."
                        )
                    }
                )
            ok = any(slot.start_time <= st and slot.end_time >= et for slot in slots)
            if not ok:
                windows = " · ".join(
                    f"{_fmt(s.start_time)}–{_fmt(s.end_time)}" for s in slots
                )
                raise serializers.ValidationError(
                    {
                        "start_time": (
                            f"المدرس مش متاح في الوقت ده · فتراته يوم {day_label}: {windows}"
                        )
                    }
                )
        return attrs


class TeacherAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherAvailability
        fields = ["id", "weekday", "start_time", "end_time"]

    def validate(self, attrs):
        weekday = attrs.get("weekday", getattr(self.instance, "weekday", None))
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if weekday is None or not start or not end:
            raise serializers.ValidationError("اليوم والوقت مطلوبان")
        if end <= start:
            raise serializers.ValidationError("وقت النهاية يجب أن يكون بعد البداية")
        win_start, win_end = TeacherAvailability.allowed_window(int(weekday))
        if start < win_start or end > win_end:
            raise serializers.ValidationError(
                "خارج النافذة المسموحة: الجمعة/السبت 12–23، وباقي الأيام 16–23 (توقيت السعودية)."
            )
        from datetime import datetime, date

        hours = (
            datetime.combine(date.min, end) - datetime.combine(date.min, start)
        ).total_seconds() / 3600.0
        if hours < 2:
            raise serializers.ValidationError(
                "كل فترة متاحة يجب ألا تقل عن ساعتين متتاليتين."
            )
        return attrs


class SessionAttendanceRecordSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    full_name = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(
        choices=SessionAttendance.Status.choices, allow_null=True, required=False
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")
