from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Email is the login identifier instead of username."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("role", User.Role.STUDENT)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("role", User.Role.ADMIN)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = "student", "طالب"
        TEACHER = "teacher", "مدرس"
        ADMIN = "admin", "مدير"

    class Gender(models.TextChoices):
        MALE = "male", "ذكر"
        FEMALE = "female", "أنثى"

    # Drop username; use email.
    username = None
    email = models.EmailField("البريد الإلكتروني", unique=True)
    full_name = models.CharField("الاسم الكامل", max_length=150)
    phone = models.CharField(
        "رقم التليفون", max_length=20, unique=True, null=True, blank=True
    )
    telegram_id = models.CharField(
        "معرف تيليجرام", max_length=64, unique=True, null=True, blank=True
    )
    telegram_username = models.CharField(
        "يوزر تيليجرام", max_length=150, blank=True, default=""
    )
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)
    taught_subject = models.ForeignKey(
        "catalog.Subject",
        related_name="teachers",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    objects = UserManager()

    def __str__(self):
        return f"{self.full_name} ({self.email})"

    @property
    def is_teacher(self):
        return self.role == self.Role.TEACHER

    @property
    def is_admin_role(self):
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def is_student(self):
        return self.role == self.Role.STUDENT

    def _cached_active_subs(self):
        """Use prefetch `to_attr='_active_subs'` or prefetched subscriptions cache."""
        cached = getattr(self, "_active_subs", None)
        if cached is not None:
            return cached
        cache = getattr(self, "_prefetched_objects_cache", None)
        if cache is not None and "subscriptions" in cache:
            today = timezone.now().date()
            active = [s for s in self.subscriptions.all() if s.end_date >= today]
            active.sort(key=lambda s: s.end_date, reverse=True)
            return active
        return None

    @property
    def has_active_subscription(self):
        cached = self._cached_active_subs()
        if cached is not None:
            return bool(cached)
        return self.subscriptions.filter(end_date__gte=timezone.now().date()).exists()

    @property
    def active_subscription(self):
        cached = self._cached_active_subs()
        if cached is not None:
            return cached[0] if cached else None
        return (
            self.subscriptions.filter(end_date__gte=timezone.now().date())
            .order_by("-end_date")
            .first()
        )


class TelegramOAuthState(models.Model):
    """PKCE state for Telegram OIDC popup login (hadafak-style)."""

    state = models.CharField(max_length=64, unique=True, db_index=True)
    code_verifier = models.CharField(max_length=128)
    redirect_uri = models.URLField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    # Idempotent complete: StrictMode / double callback can hit twice.
    consumed_user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="telegram_oauth_states",
    )
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_expired(self):
        if self.consumed_at:
            return False
        return timezone.now() >= self.expires_at

