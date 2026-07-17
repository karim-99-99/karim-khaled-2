from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    has_active_subscription = serializers.BooleanField(read_only=True)
    taught_subject_name = serializers.CharField(
        source="taught_subject.name", read_only=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "gender",
            "role",
            "taught_subject",
            "taught_subject_name",
            "has_active_subscription",
            "created_at",
        ]
        read_only_fields = ["id", "role", "created_at"]


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
        if User.objects.filter(phone=value).exists():
            raise serializers.ValidationError("رقم التليفون مسجل بالفعل")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        # New accounts can log in and browse immediately, but until an admin
        # activates them (grants a subscription / sets the role) they only get
        # the free preview: the first lesson + first 10 questions.
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
        # is_active is now an admin ban switch (new accounts can log in).
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
