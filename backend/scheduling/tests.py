from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Subject
from groups.models import GroupStudent, GroupTeacher, StudyGroup
from scheduling.models import Session, sync_session_statuses


class SessionStatusSyncTests(TestCase):
    def setUp(self):
        self.subject = Subject.objects.create(
            name="رياضيات-اختبار", slug="math-test-sync", order=1
        )
        self.admin = User.objects.create_user(
            email="admin-sync@test.local",
            password="Passw0rd!",
            full_name="Admin",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.group = StudyGroup.objects.create(name="G-sync", created_by=self.admin)

    def test_marks_ended_live_session_as_done(self):
        now = timezone.now()
        s = Session.objects.create(
            subject=self.subject,
            group=self.group,
            title="حصة منتهية",
            start_time=now - timedelta(hours=2),
            duration_minutes=60,
            status=Session.Status.LIVE,
        )
        sync_session_statuses()
        s.refresh_from_db()
        self.assertEqual(s.status, Session.Status.DONE)

    def test_marks_started_scheduled_as_live(self):
        now = timezone.now()
        s = Session.objects.create(
            subject=self.subject,
            group=self.group,
            title="حصة جارية",
            start_time=now - timedelta(minutes=10),
            duration_minutes=60,
            status=Session.Status.SCHEDULED,
        )
        sync_session_statuses()
        s.refresh_from_db()
        self.assertEqual(s.status, Session.Status.LIVE)

    def test_future_scheduled_not_touched(self):
        now = timezone.now()
        s = Session.objects.create(
            subject=self.subject,
            group=self.group,
            title="حصة قادمة",
            start_time=now + timedelta(days=1),
            duration_minutes=60,
            status=Session.Status.SCHEDULED,
        )
        sync_session_statuses()
        s.refresh_from_db()
        self.assertEqual(s.status, Session.Status.SCHEDULED)

    def test_list_sessions_auto_closes_stuck_live(self):
        now = timezone.now()
        Session.objects.create(
            subject=self.subject,
            group=self.group,
            title="عالقة",
            start_time=now - timedelta(hours=3),
            duration_minutes=45,
            status=Session.Status.LIVE,
        )
        student = User.objects.create_user(
            email="stu-sync@test.local",
            password="Passw0rd!",
            full_name="Student",
            role=User.Role.STUDENT,
        )
        GroupStudent.objects.create(group=self.group, student=student)
        client = APIClient()
        client.force_authenticate(user=student)
        res = client.get("/api/sessions/?when=upcoming")
        self.assertEqual(res.status_code, 200)
        # Ended session must not remain in upcoming.
        self.assertTrue(all(row["status"] != "live" for row in res.data))
        self.assertTrue(
            Session.objects.filter(title="عالقة", status=Session.Status.DONE).exists()
        )


class TeacherSessionScopeTests(TestCase):
    def setUp(self):
        self.math = Subject.objects.create(name="رياضيات-نطاق", slug="math-scope", order=1)
        self.phys = Subject.objects.create(name="فيزياء-نطاق", slug="phys-scope", order=2)
        self.admin = User.objects.create_user(
            email="admin-scope@test.local",
            password="Passw0rd!",
            full_name="Admin",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.teacher = User.objects.create_user(
            email="teacher-scope@test.local",
            password="Passw0rd!",
            full_name="Teacher",
            role=User.Role.TEACHER,
            taught_subject=self.math,
        )
        self.g1 = StudyGroup.objects.create(name="G1", created_by=self.admin)
        self.g2 = StudyGroup.objects.create(name="G2", created_by=self.admin)
        GroupTeacher.objects.create(
            group=self.g1, teacher=self.teacher, subject=self.math
        )
        now = timezone.now()
        Session.objects.create(
            subject=self.math,
            group=self.g1,
            title="رياضيات لي",
            start_time=now + timedelta(hours=2),
            duration_minutes=60,
        )
        Session.objects.create(
            subject=self.phys,
            group=self.g1,
            title="فيزياء ليس لي",
            start_time=now + timedelta(hours=3),
            duration_minutes=60,
        )
        Session.objects.create(
            subject=self.math,
            group=self.g2,
            title="رياضيات مجموعة أخرى",
            start_time=now + timedelta(hours=4),
            duration_minutes=60,
        )

    def test_teacher_sees_only_own_subject_groups(self):
        client = APIClient()
        client.force_authenticate(user=self.teacher)
        res = client.get("/api/sessions/")
        self.assertEqual(res.status_code, 200)
        titles = {row["title"] for row in res.data}
        self.assertIn("رياضيات لي", titles)
        self.assertNotIn("فيزياء ليس لي", titles)
        self.assertNotIn("رياضيات مجموعة أخرى", titles)


class HeavyScheduleListTests(TestCase):
    def test_list_many_sessions_stays_fast(self):
        subject = Subject.objects.create(
            name="رياضيات-ثقيل", slug="math-heavy", order=1
        )
        admin = User.objects.create_user(
            email="admin-heavy@test.local",
            password="Passw0rd!",
            full_name="Admin",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        group = StudyGroup.objects.create(name="Heavy", created_by=admin)
        student = User.objects.create_user(
            email="stu-heavy@test.local",
            password="Passw0rd!",
            full_name="Student",
            role=User.Role.STUDENT,
        )
        GroupStudent.objects.create(group=group, student=student)
        now = timezone.now()
        Session.objects.bulk_create(
            [
                Session(
                    subject=subject,
                    group=group,
                    title=f"S{i}",
                    start_time=now + timedelta(hours=i),
                    duration_minutes=45,
                    status=Session.Status.SCHEDULED,
                )
                for i in range(1, 121)
            ]
        )
        # Sprinkle a few that need syncing
        Session.objects.bulk_create(
            [
                Session(
                    subject=subject,
                    group=group,
                    title=f"OLD{i}",
                    start_time=now - timedelta(hours=i + 2),
                    duration_minutes=30,
                    status=Session.Status.LIVE,
                )
                for i in range(20)
            ]
        )
        client = APIClient()
        client.force_authenticate(user=student)
        import time

        t0 = time.perf_counter()
        res = client.get("/api/sessions/?when=upcoming")
        elapsed = time.perf_counter() - t0
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 120)
        # Remote Neon latency varies; catch pathological regressions only.
        self.assertLess(elapsed, 12.0, f"schedule list too slow: {elapsed:.2f}s")
