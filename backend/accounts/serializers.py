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
            "taught_subject",
            "taught_subject_name",
            "teachable_subject_ids",
            "has_active_subscription",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "role",
            "email",
            "telegram_id",
            "telegram_username",
            "teachable_subject_ids",
            "created_at",
        ]

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

    class Meta:
        model = User
        fields = ["full_name", "phone", "gender", "email", "password"]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("هذا البريد مسجل بالفعل")
        return value.lower()

    def validate_phone(self, value):
        normalized = normalize_phone(value)
        if len(normalized) < 10:
            raise serializers.ValidationError("رقم التليفون غير صحيح")
        for candidate in phones_match_query(value):
            if User.objects.filter(phone=candidate).exists():
                raise serializers.ValidationError("رقم التليفون مسجل بالفعل")
        if User.objects.filter(phone=normalized).exists():
            raise serializers.ValidationError("رقم التليفون مسجل بالفعل")
        return normalized

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
