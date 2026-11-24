from django.conf import settings
from django.db import models


class StudyGroup(models.Model):
    """A class group created by an admin. Students and teachers are attached to it."""

    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="groups_created",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class GroupStudent(models.Model):
    """
    Membership is permanent (kept even when a subscription expires) so the
    teacher keeps the student's history. The active/expired badge is derived
    at query time from the student's subscription, not stored here.
    """

    group = models.ForeignKey(
        StudyGroup, related_name="student_links", on_delete=models.CASCADE
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="group_memberships",
        on_delete=models.CASCADE,
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "student")

    def __str__(self):
        return f"{self.student.full_name} @ {self.group.name}"


class GroupTeacher(models.Model):
    """
    A teacher assigned to a group, tagged with the single subject they teach in
    that group. All teacher data access is scoped through these rows.
    """

    group = models.ForeignKey(
        StudyGroup, related_name="teacher_links", on_delete=models.CASCADE
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="teaching_assignments",
        on_delete=models.CASCADE,
    )
    subject = models.ForeignKey(
        "catalog.Subject", related_name="teacher_links", on_delete=models.CASCADE
    )

    class Meta:
        unique_together = ("group", "teacher", "subject")

    def __str__(self):
        return f"{self.teacher.full_name} teaches {self.subject.name} @ {self.group.name}"


class TeacherSubjectRole(models.Model):
    """
    Main vs secondary teacher per subject (brief B5 / Global — Roles).
    Only ONE main teacher per subject (plus admin).
    """

    class Role(models.TextChoices):
        MAIN = "main", "مدرس أساسي"
        SECONDARY = "secondary", "مدرس ثانوي"

    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="subject_roles",
        on_delete=models.CASCADE,
    )
    subject = models.ForeignKey(
        "catalog.Subject",
        related_name="teacher_roles",
        on_delete=models.CASCADE,
    )
    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.SECONDARY
    )

    class Meta:
        unique_together = ("teacher", "subject")
        constraints = [
            models.UniqueConstraint(
                fields=["subject"],
                condition=models.Q(role="main"),
                name="uniq_main_teacher_per_subject",
            )
        ]

    def __str__(self):
        return f"{self.teacher_id} · {self.subject_id} · {self.role}"
