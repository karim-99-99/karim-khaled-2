from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


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
    phone = models.CharField("رقم التليفون", max_length=20, unique=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)
    # For teachers: the single subject they teach. Lessons/questions they create
    # are filed under this subject and reach all groups they are assigned to.
    taught_subject = models.ForeignKey(
        "catalog.Subject",
        related_name="teachers",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name", "phone"]

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

    @property
    def has_active_subscription(self):
        """True when the student has a subscription whose end_date is in the future."""
        from django.utils import timezone

        return self.subscriptions.filter(end_date__gte=timezone.now().date()).exists()

    @property
    def active_subscription(self):
        """The current (latest) active subscription object, or None."""
        from django.utils import timezone

        return (
            self.subscriptions.filter(end_date__gte=timezone.now().date())
            .order_by("-end_date")
            .first()
        )
