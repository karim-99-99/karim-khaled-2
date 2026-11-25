"""Task 29 — admin cannot schedule outside teacher availability."""

from datetime import datetime, time, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Subject
from groups.models import GroupTeacher, StudyGroup
from scheduling.models import TeacherAvailability

User = get_user_model()
RIYADH = ZoneInfo("Asia/Riyadh")


class AvailabilityGuardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.bio = Subject.objects.create(name="أحياء-29", slug="bio-29", theme_key="bio")
        self.admin = User.objects.create_user(
            email="admin29@test.com",
            password="pass12345",
            full_name="Admin",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.teacher = User.objects.create_user(
            email="t29@test.com",
            password="pass12345",
            full_name="محمد",
            role=User.Role.TEACHER,
            taught_subject=self.bio,
        )
        self.g = StudyGroup.objects.create(name="مجموعة ب")
        GroupTeacher.objects.create(
            group=self.g, teacher=self.teacher, subject=self.bio
        )

    def _sunday_at(self, hour, minute=0):
        # Next Sunday at hour:minute Asia/Riyadh
        now = timezone.now().astimezone(RIYADH)
        days_ahead = (6 - now.weekday()) % 7
        if days_ahead == 0 and now.hour >= 20:
            days_ahead = 7
        day = (now + timedelta(days=days_ahead)).date()
        local = datetime(day.year, day.month, day.day, hour, minute, tzinfo=RIYADH)
        return local.astimezone(dt_timezone.utc)

    def test_reject_when_no_availability(self):
        self.client.force_authenticate(user=self.admin)
        start = self._sunday_at(16)
        res = self.client.post(
            "/api/sessions/",
            {
                "title": "حصة",
                "subject": self.bio.id,
                "group": self.g.id,
                "teacher": self.teacher.id,
                "start_time": start.isoformat(),
                "duration_minutes": 120,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("مواعيد", str(res.data))

    def test_reject_outside_window(self):
        TeacherAvailability.objects.create(
            teacher=self.teacher,
            weekday=6,  # Sunday
            start_time=time(16, 0),
            end_time=time(20, 0),
        )
        self.client.force_authenticate(user=self.admin)
        # Sunday 14:00 Riyadh — outside 16–20
        start = self._sunday_at(14)
        res = self.client.post(
            "/api/sessions/",
            {
                "title": "حصة",
                "subject": self.bio.id,
                "group": self.g.id,
                "teacher": self.teacher.id,
                "start_time": start.isoformat(),
                "duration_minutes": 120,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("مش متاح", str(res.data))

    def test_accept_inside_window(self):
        TeacherAvailability.objects.create(
            teacher=self.teacher,
            weekday=6,
            start_time=time(16, 0),
            end_time=time(20, 0),
        )
        self.client.force_authenticate(user=self.admin)
        start = self._sunday_at(16)
        res = self.client.post(
            "/api/sessions/",
            {
                "title": "حصة",
                "subject": self.bio.id,
                "group": self.g.id,
                "teacher": self.teacher.id,
                "start_time": start.isoformat(),
                "duration_minutes": 120,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
