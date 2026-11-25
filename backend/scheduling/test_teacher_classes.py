"""Task 28 — teacher classes page."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Subject
from groups.models import GroupStudent, GroupTeacher, StudyGroup
from scheduling.models import Session
from scheduling.teacher_classes import build_teacher_classes

User = get_user_model()


class TeacherClassesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.bio = Subject.objects.create(name="أحياء-28", slug="bio-28", theme_key="bio")
        self.teacher = User.objects.create_user(
            email="t28@test.com",
            password="pass12345",
            full_name="مدرس أحياء",
            role=User.Role.TEACHER,
            taught_subject=self.bio,
        )
        self.g = StudyGroup.objects.create(name="مجموعة أ")
        GroupTeacher.objects.create(group=self.g, teacher=self.teacher, subject=self.bio)
        self.stu = User.objects.create_user(
            email="s28@test.com",
            password="pass12345",
            full_name="طالب",
            role=User.Role.STUDENT,
        )
        GroupStudent.objects.create(group=self.g, student=self.stu)
        now = timezone.now()
        self.upcoming = Session.objects.create(
            title="حصة جاية",
            subject=self.bio,
            group=self.g,
            teacher=self.teacher,
            start_time=now + timedelta(hours=3),
            duration_minutes=60,
        )
        self.ended = Session.objects.create(
            title="حصة فاتت",
            subject=self.bio,
            group=self.g,
            teacher=self.teacher,
            start_time=now - timedelta(hours=3),
            duration_minutes=60,
            status=Session.Status.DONE,
        )

    def test_build_week_and_needs_rating(self):
        payload = build_teacher_classes(self.teacher)
        self.assertEqual(payload["header"]["groups"], 1)
        self.assertEqual(payload["needs_rating"]["count"], 1)
        self.assertEqual(payload["needs_rating"]["oldest_id"], self.ended.id)
        self.assertEqual(len(payload["week"]), 7)
        ids = {s["id"] for s in payload["past"]["sessions"]}
        self.assertIn(self.ended.id, ids)

    def test_api(self):
        self.client.force_authenticate(user=self.teacher)
        res = self.client.get("/api/teacher/classes/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["needs_rating"]["count"], 1)
