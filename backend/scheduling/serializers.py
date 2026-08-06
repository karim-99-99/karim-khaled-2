from django.db.models import Count, Q
from rest_framework import serializers

from .models import Session, SessionAttendance


class SessionSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True, default="")
    display_title = serializers.CharField(read_only=True)
    session_number = serializers.SerializerMethodField()
    my_attendance = serializers.SerializerMethodField()
    attendance_summary = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            "id",
            "title",
            "display_title",
            "subject",
            "subject_name",
            "group",
            "group_name",
            "teacher",
            "teacher_name",
            "start_time",
            "duration_minutes",
            "zoom_link",
            "status",
            "session_number",
            "my_attendance",
            "attendance_summary",
        ]
        read_only_fields = [
            "id",
            "display_title",
            "subject_name",
            "group_name",
            "teacher_name",
            "session_number",
            "my_attendance",
            "attendance_summary",
        ]

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
        rows = qs.order_by("start_time", "id").values_list(
            "id", "subject_id", "group_id"
        )
        counters = {}
        for sid, subject_id, group_id in rows:
            key = (subject_id, group_id)
            counters[key] = counters.get(key, 0) + 1
            cache[sid] = counters[key]
        self.context["_session_numbers"] = cache
        return cache

    def get_session_number(self, obj):
        cache = self._build_session_numbers()
        if obj.id in cache:
            return cache[obj.id]
        earlier = Session.objects.filter(subject_id=obj.subject_id)
        if obj.group_id:
            earlier = earlier.filter(group_id=obj.group_id)
        else:
            earlier = earlier.filter(group_id__isnull=True)
        return (
            earlier.filter(
                Q(start_time__lt=obj.start_time)
                | Q(start_time=obj.start_time, id__lte=obj.id)
            ).count()
        )

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
        # Teachers may only write Zoom (+ status); schedule fields stay read-only.
        if user.is_teacher and not user.is_admin_role:
            for name in (
                "title",
                "subject",
                "group",
                "teacher",
                "start_time",
                "duration_minutes",
            ):
                if name in self.fields:
                    self.fields[name].read_only = True


class SessionAttendanceRecordSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    full_name = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(
        choices=SessionAttendance.Status.choices, allow_null=True, required=False
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")
