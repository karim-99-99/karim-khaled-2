"""Task 27 — teacher home dashboard scoping."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Subject
from groups.models import GroupStudent, GroupTeacher, StudyGroup
from scheduling.models import Session
from scheduling.teacher_home import build_teacher_home

User = get_user_model()


class TeacherHomeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.bio = Subject.objects.create(name="أحياء", slug="bio", theme_key="bio")
        self.math = Subject.objects.create(name="رياضيات", slug="math", theme_key="math")
        self.teacher = User.objects.create_user(
            email="t27@test.com",
            password="pass12345",
            full_name="محمد المدرس",
            role=User.Role.TEACHER,
            taught_subject=self.bio,
        )
        self.other = User.objects.create_user(
            email="t27b@test.com",
            password="pass12345",
            full_name="مدرس آخر",
            role=User.Role.TEACHER,
            taught_subject=self.math,
        )
        self.g_a = StudyGroup.objects.create(name="مجموعة أ")
        self.g_b = StudyGroup.objects.create(name="مجموعة ب")
        GroupTeacher.objects.create(
            group=self.g_a, teacher=self.teacher, subject=self.bio
        )
        GroupTeacher.objects.create(
            group=self.g_b, teacher=self.other, subject=self.math
        )
        self.stu = User.objects.create_user(
            email="s27@test.com",
            password="pass12345",
            full_name="سارة الدوسري",
            role=User.Role.STUDENT,
        )
        GroupStudent.objects.create(group=self.g_a, student=self.stu)
        now = timezone.now()
        Session.objects.create(
            title="درس أ",
            subject=self.bio,
            group=self.g_a,
            teacher=self.teacher,
            start_time=now + timedelta(hours=2),
            duration_minutes=60,
        )
        Session.objects.create(
            title="درس ب",
            subject=self.math,
            group=self.g_b,
            teacher=self.other,
            start_time=now + timedelta(hours=3),
            duration_minutes=60,
        )

    def test_build_scopes_to_teacher_groups(self):
        payload = build_teacher_home(self.teacher)
        self.assertEqual(payload["kpis"]["groups"], 1)
        self.assertEqual(payload["kpis"]["students"], 1)
        self.assertEqual(payload["kpis"]["classes_today"], 1)
        titles = [c["title"] for c in payload["my_classes"]]
        self.assertIn("درس أ", titles)
        self.assertNotIn("درس ب", titles)
        self.assertEqual(payload["next_class"]["title"], "درس أ")
        self.assertEqual(payload["subject"]["name"], "أحياء")

    def test_api_requires_teacher(self):
        self.client.force_authenticate(user=self.stu)
        res = self.client.get("/api/teacher/home/")
        self.assertIn(res.status_code, (403, 401))

    def test_api_ok_for_teacher(self):
        self.client.force_authenticate(user=self.teacher)
        res = self.client.get("/api/teacher/home/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["kpis"]["students"], 1)
        self.assertTrue(res.data["teacher"]["greeting"].startswith("أهلاً"))

    def test_remind_scoped(self):
        self.client.force_authenticate(user=self.other)
        res = self.client.post(f"/api/teacher/students/{self.stu.id}/remind/")
        self.assertEqual(res.status_code, 403)
