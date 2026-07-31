from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .phone import normalize_phone, phones_match_query, synthetic_email

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
            "telegram_id",
            "telegram_username",
            "contact_channel",
            "gender",
            "role",
            "taught_subject",
            "taught_subject_name",
            "has_active_subscription",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "role",
            "telegram_id",
            "telegram_username",
            "created_at",
        ]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    contact_channel = serializers.ChoiceField(
        choices=User.ContactChannel.choices,
        default=User.ContactChannel.EMAIL,
    )
    email = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "full_name",
            "phone",
            "gender",
            "email",
            "password",
            "contact_channel",
        ]

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

    def validate(self, attrs):
        channel = attrs.get("contact_channel") or User.ContactChannel.EMAIL
        email = (attrs.get("email") or "").strip().lower()

        if channel in (
            User.ContactChannel.TELEGRAM,
            User.ContactChannel.WHATSAPP,
        ):
            # Messenger signup: email is filled automatically from the phone.
            phone = attrs["phone"]
            email = synthetic_email(phone, channel)
            if User.objects.filter(email__iexact=email).exists():
                raise serializers.ValidationError(
                    {"phone": "هذا الرقم مسجل بالفعل"}
                )
            attrs["email"] = email
        else:
            if not email:
                raise serializers.ValidationError(
                    {"email": "البريد الإلكتروني مطلوب"}
                )
            if User.objects.filter(email__iexact=email).exists():
                raise serializers.ValidationError(
                    {"email": "هذا البريد مسجل بالفعل"}
                )
            attrs["email"] = email

        attrs["contact_channel"] = channel
        return attrs

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
    """Login with email+password OR phone+password (Telegram / WhatsApp)."""

    phone = serializers.CharField(required=False, allow_blank=True, write_only=True)
    login_method = serializers.ChoiceField(
        choices=["email", "telegram", "whatsapp"],
        required=False,
        default="email",
        write_only=True,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Parent marks USERNAME_FIELD (email) as required; phone login skips it.
        self.fields[self.username_field].required = False
        self.fields[self.username_field].allow_blank = True

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = user.full_name
        return token

    def validate(self, attrs):
        method = attrs.pop("login_method", None) or "email"
        phone = (attrs.pop("phone", None) or "").strip()
        email = (attrs.get(self.username_field) or "").strip()

        if method in ("telegram", "whatsapp") or (phone and not email):
            user = None
            for candidate in phones_match_query(phone):
                user = User.objects.filter(phone=candidate).first()
                if user:
                    break
            if not user:
                normalized = normalize_phone(phone)
                user = User.objects.filter(phone=normalized).first()
            if not user:
                raise serializers.ValidationError(
                    {"detail": "رقم التليفون أو كلمة المرور غير صحيحة"}
                )
            if not user.is_active:
                raise serializers.ValidationError(
                    {"detail": "تم إيقاف حسابك، برجاء التواصل مع الإدارة."}
                )
            attrs[self.username_field] = user.email
        else:
            banned = User.objects.filter(
                email__iexact=email, is_active=False
            ).first()
            if banned:
                raise serializers.ValidationError(
                    {"detail": "تم إيقاف حسابك، برجاء التواصل مع الإدارة."}
                )
            attrs[self.username_field] = email.lower()

        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
