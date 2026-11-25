from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .phone import normalize_phone, phones_match_query

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    has_active_subscription = serializers.BooleanField(read_only=True)
    taught_subject_name = serializers.CharField(
        source="taught_subject.name", read_only=True
    )
    teachable_subject_ids = serializers.SerializerMethodField()
    editable_subject_ids = serializers.SerializerMethodField()
    teacher_subject_roles = serializers.SerializerMethodField()
    subscription_plan = serializers.SerializerMethodField()
    is_gold = serializers.SerializerMethodField()
    is_silver = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "telegram_id",
            "telegram_username",
            "gender",
            "role",
            "region",
            "city",
            "school_name",
            "school_type",
            "guardian_phone",
            "taught_subject",
            "taught_subject_name",
            "teachable_subject_ids",
            "editable_subject_ids",
            "teacher_subject_roles",
            "has_active_subscription",
            "subscription_plan",
            "is_gold",
            "is_silver",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "role",
            "email",
            "telegram_id",
            "telegram_username",
            "taught_subject",
            "taught_subject_name",
            "teachable_subject_ids",
            "editable_subject_ids",
            "teacher_subject_roles",
            "subscription_plan",
            "is_gold",
            "is_silver",
            "created_at",
        ]

    def get_subscription_plan(self, obj):
        from core.plans import active_plan_code

        return active_plan_code(obj)

    def get_is_gold(self, obj):
        from core.plans import is_gold_student

        return is_gold_student(obj)

    def get_is_silver(self, obj):
        from core.plans import is_silver_student

        return is_silver_student(obj)

    def get_editable_subject_ids(self, obj):
        from core.access import teacher_can_edit_content, teacher_subject_ids

        if getattr(obj, "is_admin_role", False):
            from catalog.models import Subject

            return list(Subject.objects.values_list("id", flat=True))
        return [
            sid
            for sid in teacher_subject_ids(obj)
            if teacher_can_edit_content(obj, sid)
        ]

    def get_teacher_subject_roles(self, obj):
        from core.access import teacher_role_for_subject, teacher_subject_ids

        if getattr(obj, "is_admin_role", False):
            from catalog.models import Subject

            return {
                str(sid): "main"
                for sid in Subject.objects.values_list("id", flat=True)
            }
        out = {}
        for sid in teacher_subject_ids(obj):
            role = teacher_role_for_subject(obj, sid)
            if role:
                out[str(sid)] = role
        return out

    def get_teachable_subject_ids(self, obj):
        from core.access import teacher_subject_ids

        if getattr(obj, "is_admin_role", False):
            from catalog.models import Subject

            return list(Subject.objects.values_list("id", flat=True))
        if not getattr(obj, "is_teacher", False):
            return []
        return sorted(teacher_subject_ids(obj))


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=6)
    new_password_confirm = serializers.CharField(write_only=True, min_length=6)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "كلمة المرور الجديدة غير متطابقة"}
            )
        return attrs

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("كلمة المرور الحالية غير صحيحة")
        return value


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    guardian_phone = serializers.CharField(
        required=False, allow_blank=True, default=""
    )

    class Meta:
        model = User
        fields = [
            "full_name",
            "first_name",
            "last_name",
            "phone",
            "guardian_phone",
            "gender",
            "email",
            "password",
            "region",
            "city",
            "school_name",
            "school_type",
        ]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("هذا البريد مسجل بالفعل")
        return value.lower()

    def validate_phone(self, value):
        normalized = normalize_phone(value)
        if len(normalized) < 10:
            raise serializers.ValidationError("رقم الجوال غير صحيح")
        for candidate in phones_match_query(value):
            if User.objects.filter(phone=candidate).exists():
                raise serializers.ValidationError("رقم الجوال مسجل بالفعل")
        if User.objects.filter(phone=normalized).exists():
            raise serializers.ValidationError("رقم الجوال مسجل بالفعل")
        return normalized

    def validate_guardian_phone(self, value):
        if not value:
            return ""
        normalized = normalize_phone(value)
        if len(normalized) < 10:
            raise serializers.ValidationError("رقم جوال ولي الأمر غير صحيح")
        return normalized

    def validate_region(self, value):
        if not (value or "").strip():
            raise serializers.ValidationError("المنطقة مطلوبة")
        return value.strip()

    def validate_city(self, value):
        if not (value or "").strip():
            raise serializers.ValidationError("المدينة مطلوبة")
        return value.strip()

    def validate_school_name(self, value):
        if not (value or "").strip():
            raise serializers.ValidationError("اسم المدرسة مطلوب")
        return value.strip()

    def validate_school_type(self, value):
        allowed = {User.SchoolType.GOVERNMENT, User.SchoolType.PRIVATE}
        if value not in allowed:
            raise serializers.ValidationError("اختر نوع المدرسة")
        return value

    def validate(self, attrs):
        first = (attrs.pop("first_name", "") or "").strip()
        last = (attrs.pop("last_name", "") or "").strip()
        full = (attrs.get("full_name") or "").strip()
        if first or last:
            attrs["full_name"] = f"{first} {last}".strip()
        elif not full:
            raise serializers.ValidationError({"full_name": "الاسم مطلوب"})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User.objects.create_user(
            password=password, role=User.Role.STUDENT, **validated_data
        )
        return user


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds user profile info to the login response."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = user.full_name
        return token

    def validate(self, attrs):
        banned = User.objects.filter(
            email__iexact=attrs.get("email", ""), is_active=False
        ).first()
        if banned:
            raise serializers.ValidationError(
                {"detail": "تم إيقاف حسابك، برجاء التواصل مع الإدارة."}
            )
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
