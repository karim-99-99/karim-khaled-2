from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from billing.models import Subscription
from catalog.models import Lesson, Subject
from core.access import (
    assign_teacher_subject_role,
    teacher_can_edit_content,
    teacher_role_for_subject,
)
from groups.models import TeacherSubjectRole


class TeacherSubjectRoleTests(TestCase):
    def setUp(self):
        self.math = Subject.objects.create(name="رياضيات-أدوار", slug="math-roles", order=1)
        self.bio = Subject.objects.create(name="أحياء-أدوار", slug="bio-roles", order=2)
        self.admin = User.objects.create_user(
            email="admin-roles@test.local",
            password="Passw0rd!",
            full_name="Admin",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.main = User.objects.create_user(
            email="main-roles@test.local",
            password="Passw0rd!",
            full_name="Main",
            role=User.Role.TEACHER,
        )
        self.secondary = User.objects.create_user(
            email="sec-roles@test.local",
            password="Passw0rd!",
            full_name="Secondary",
            role=User.Role.TEACHER,
        )
        self.other_main = User.objects.create_user(
            email="other-main@test.local",
            password="Passw0rd!",
            full_name="OtherMain",
            role=User.Role.TEACHER,
        )
        assign_teacher_subject_role(self.main, self.math, TeacherSubjectRole.Role.MAIN)
        assign_teacher_subject_role(
            self.secondary, self.math, TeacherSubjectRole.Role.SECONDARY
        )
        assign_teacher_subject_role(
            self.other_main, self.bio, TeacherSubjectRole.Role.MAIN
        )
        self.lesson = Lesson.objects.create(
            subject=self.math,
            title="درس 1",
            order_number=1,
            created_by=self.main,
        )
        self.client = APIClient()

    def test_only_one_main_per_subject(self):
        assign_teacher_subject_role(
            self.secondary, self.math, TeacherSubjectRole.Role.MAIN
        )
        self.assertEqual(
            teacher_role_for_subject(self.secondary, self.math.id), "main"
        )
        self.assertEqual(
            teacher_role_for_subject(self.main, self.math.id), "secondary"
        )
        self.assertEqual(
            TeacherSubjectRole.objects.filter(
                subject=self.math, role=TeacherSubjectRole.Role.MAIN
            ).count(),
            1,
        )

    def test_secondary_cannot_edit_content_via_api(self):
        self.client.force_authenticate(user=self.secondary)
        res = self.client.post(
            "/api/lessons/",
            {
                "subject": self.math.id,
                "title": "درس ممنوع",
                "order_number": 99,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_main_can_edit_own_subject_not_other(self):
        self.assertTrue(teacher_can_edit_content(self.main, self.math.id))
        self.assertFalse(teacher_can_edit_content(self.main, self.bio.id))
        self.client.force_authenticate(user=self.main)
        ok = self.client.post(
            "/api/lessons/",
            {
                "subject": self.math.id,
                "title": "درس مسموح",
                "order_number": 2,
            },
            format="json",
        )
        self.assertEqual(ok.status_code, 201, ok.data)
        denied = self.client.post(
            "/api/lessons/",
            {
                "subject": self.bio.id,
                "title": "مادة تانية",
                "order_number": 2,
            },
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

    def test_teacher_cannot_self_assign_taught_subject(self):
        self.client.force_authenticate(user=self.secondary)
        res = self.client.patch(
            "/api/auth/me/",
            {"taught_subject": self.math.id},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.secondary.refresh_from_db()
        # Field is read-only — must not become main via /auth/me/
        self.assertNotEqual(
            teacher_role_for_subject(self.secondary, self.math.id), "main"
        )
        self.assertFalse(teacher_can_edit_content(self.secondary, self.math.id))

    def test_admin_set_subject_role_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(
            f"/api/admin/users/{self.secondary.id}/set-subject/",
            {
                "taught_subject": self.math.id,
                "subject_role": "main",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("subject_role"), "main")
        self.secondary.refresh_from_db()
        self.main.refresh_from_db()
        self.assertEqual(
            teacher_role_for_subject(self.secondary, self.math.id), "main"
        )
        self.assertEqual(
            teacher_role_for_subject(self.main, self.math.id), "secondary"
        )


class GoldSilverPlanGateTests(TestCase):
    def setUp(self):
        self.subject = Subject.objects.create(
            name="فيزياء-باقات", slug="physics-plans", order=1
        )
        self.lesson = Lesson.objects.create(
            subject=self.subject, title="L1", order_number=1
        )
        self.silver = User.objects.create_user(
            email="silver-plan@test.local",
            password="Passw0rd!",
            full_name="Silver",
            role=User.Role.STUDENT,
        )
        today = timezone.now().date()
        Subscription.objects.create(
            student=self.silver,
            plan=Subscription.Plan.SILVER,
            start_date=today,
            end_date=today + timedelta(days=30),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.silver)

    def test_silver_sessions_list_403(self):
        res = self.client.get("/api/sessions/")
        self.assertEqual(res.status_code, 403)

    def test_silver_next_session_403(self):
        res = self.client.get("/api/home/next-session/")
        self.assertEqual(res.status_code, 403)

    def test_silver_time_rules_403(self):
        res = self.client.get("/api/home/time-rules/")
        self.assertEqual(res.status_code, 403)

    def test_silver_teacher_tests_list_403(self):
        res = self.client.get(f"/api/teacher-tests/?subject={self.subject.id}")
        self.assertEqual(res.status_code, 403)

    def test_silver_lesson_not_schedule_locked(self):
        res = self.client.get(f"/api/lessons/?subject={self.subject.id}")
        self.assertEqual(res.status_code, 200)
        rows = res.data["results"] if isinstance(res.data, dict) else res.data
        self.assertTrue(len(rows) >= 1)
        self.assertFalse(rows[0].get("schedule_locked"))

