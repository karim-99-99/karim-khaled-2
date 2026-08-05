from rest_framework import serializers

from accounts.models import User
from .models import GroupStudent, GroupTeacher, StudyGroup


def _subscription_info(user):
    """Shared subscription summary — uses prefetched `_active_subs` when present."""
    sub = user.active_subscription
    if not sub:
        return {
            "subscription_status": "expired",
            "subscription_plan": None,
            "subscription_plan_label": None,
            "subscription_start": None,
            "subscription_end": None,
            "subscription_days_remaining": 0,
        }
    return {
        "subscription_status": "active",
        "subscription_plan": sub.plan,
        "subscription_plan_label": sub.get_plan_display(),
        "subscription_start": sub.start_date,
        "subscription_end": sub.end_date,
        "subscription_days_remaining": sub.days_remaining,
    }


class GroupStudentSerializer(serializers.ModelSerializer):
    student_id = serializers.IntegerField(source="student.id", read_only=True)
    full_name = serializers.CharField(source="student.full_name", read_only=True)
    phone = serializers.CharField(source="student.phone", read_only=True)
    email = serializers.CharField(source="student.email", read_only=True)
    role = serializers.CharField(default="student", read_only=True)
    account_active = serializers.BooleanField(source="student.is_active", read_only=True)
    subscription = serializers.SerializerMethodField()
    subscription_status = serializers.SerializerMethodField()

    class Meta:
        model = GroupStudent
        fields = [
            "id",
            "student_id",
            "full_name",
            "phone",
            "email",
            "role",
            "account_active",
            "subscription",
            "subscription_status",
            "joined_at",
        ]

    def get_subscription(self, obj):
        info = _subscription_info(obj.student)
        obj._sub_cache = info
        return info

    def get_subscription_status(self, obj):
        info = getattr(obj, "_sub_cache", None)
        if info is None:
            info = _subscription_info(obj.student)
            obj._sub_cache = info
        return info["subscription_status"]


class GroupTeacherSerializer(serializers.ModelSerializer):
    teacher_id = serializers.IntegerField(source="teacher.id", read_only=True)
    full_name = serializers.CharField(source="teacher.full_name", read_only=True)
    phone = serializers.CharField(source="teacher.phone", read_only=True)
    email = serializers.CharField(source="teacher.email", read_only=True)
    role = serializers.CharField(default="teacher", read_only=True)
    account_active = serializers.BooleanField(source="teacher.is_active", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = GroupTeacher
        fields = [
            "id",
            "teacher_id",
            "full_name",
            "phone",
            "email",
            "role",
            "account_active",
            "subject",
            "subject_name",
        ]


class StudyGroupSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()
    active_count = serializers.SerializerMethodField()
    expired_count = serializers.SerializerMethodField()
    teachers = GroupTeacherSerializer(source="teacher_links", many=True, read_only=True)

    class Meta:
        model = StudyGroup
        fields = [
            "id",
            "name",
            "description",
            "student_count",
            "active_count",
            "expired_count",
            "teachers",
            "created_at",
        ]

    def get_student_count(self, obj):
        if hasattr(obj, "_student_count_ann"):
            return obj._student_count_ann
        # Prefetched: len() hits cache; .count() would hit DB again.
        return len(obj.student_links.all())

    def get_active_count(self, obj):
        if hasattr(obj, "_active_count_ann"):
            return obj._active_count_ann
        return sum(
            1 for link in obj.student_links.all() if link.student.has_active_subscription
        )

    def get_expired_count(self, obj):
        total = self.get_student_count(obj)
        active = self.get_active_count(obj)
        return max(total - active, 0)


class AdminUserSerializer(serializers.ModelSerializer):
    """Used for the 'available users' pickers and account activation."""

    subscription = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "phone",
            "email",
            "role",
            "is_active",
            "subscription",
        ]

    def get_subscription(self, obj):
        return _subscription_info(obj)
