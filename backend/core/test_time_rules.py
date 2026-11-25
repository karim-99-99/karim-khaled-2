from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from billing.models import Subscription
from catalog.models import Lesson, Subject
from core.time_rules import (
    class_state,
    is_lesson_unlocked,
    lessons_taken_for_student,
    released_tasks_for_student,
)
from groups.models import GroupStudent, GroupTeacher, StudyGroup
from scheduling.models import Session


class TimeRulesAcceptanceTests(TestCase):
    def setUp(self):
        self.subject = Subject.objects.create(
            name="رياضيات-وقت", slug="math-time", order=1
        )
        self.lessons = [
            Lesson.objects.create(
                subject=self.subject, title=f"L{i}", order_number=i
            )
            for i in range(1, 4)
        ]
        self.admin = User.objects.create_user(
            email="admin-time@test.local",
            password="Passw0rd!",
            full_name="A",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.teacher = User.objects.create_user(
            email="t-time@test.local",
            password="Passw0rd!",
            full_name="T",
            role=User.Role.TEACHER,
        )
        self.student_a = User.objects.create_user(
            email="a-time@test.local",
            password="Passw0rd!",
            full_name="A",
            role=User.Role.STUDENT,
        )
        self.student_b = User.objects.create_user(
            email="b-time@test.local",
            password="Passw0rd!",
            full_name="B",
            role=User.Role.STUDENT,
        )
        self.silver = User.objects.create_user(
            email="silver-time@test.local",
            password="Passw0rd!",
            full_name="Silver",
            role=User.Role.STUDENT,
        )
        today = timezone.now().date()
        for u, plan in (
            (self.student_a, Subscription.Plan.GOLD),
            (self.student_b, Subscription.Plan.GOLD),
            (self.silver, Subscription.Plan.SILVER),
        ):
            Subscription.objects.create(
                student=u, plan=plan, start_date=today, end_date=today + timedelta(days=30)
            )
        self.group_a = StudyGroup.objects.create(name="مجموعة أ", created_by=self.admin)
        self.group_b = StudyGroup.objects.create(name="مجموعة ب", created_by=self.admin)
        GroupTeacher.objects.create(
            group=self.group_a, teacher=self.teacher, subject=self.subject
        )
        GroupTeacher.objects.create(
            group=self.group_b, teacher=self.teacher, subject=self.subject
        )
        GroupStudent.objects.create(group=self.group_a, student=self.student_a)
        GroupStudent.objects.create(group=self.group_b, student=self.student_b)

        # Group A class: 3:00–4:30 (use a fixed base day)
        base = timezone.now().replace(hour=12, minute=0, second=0, microsecond=0)
        self.start = base.replace(hour=15, minute=0)
        self.session_a = Session.objects.create(
            subject=self.subject,
            group=self.group_a,
            teacher=self.teacher,
            title="حصة 1",
            session_type=Session.SessionType.FOUNDATION,
            start_time=self.start,
            duration_minutes=90,
        )
        # Same lesson for group B tomorrow
        self.session_b = Session.objects.create(
            subject=self.subject,
            group=self.group_b,
            teacher=self.teacher,
            title="حصة 1",
            session_type=Session.SessionType.FOUNDATION,
            start_time=self.start + timedelta(days=1),
            duration_minutes=90,
        )

    def test_class_state_timeline(self):
        s = self.session_a
        self.assertEqual(
            class_state(s, self.start - timedelta(minutes=1)), "upcoming"
        )
        self.assertEqual(
            class_state(s, self.start + timedelta(minutes=1)), "waiting_teacher"
        )
        s.teacher_joined_zoom = True
        s.save(update_fields=["teacher_joined_zoom"])
        self.assertEqual(
            class_state(s, self.start + timedelta(minutes=1)), "live"
        )
        self.assertEqual(
            class_state(s, self.start + timedelta(minutes=91)), "ended"
        )

    def test_other_group_still_locked(self):
        # During group A's class, group B student still locked on lesson 1
        during = self.start + timedelta(minutes=10)
        self.assertTrue(is_lesson_unlocked(self.student_a, self.lessons[0], during))
        self.assertFalse(is_lesson_unlocked(self.student_b, self.lessons[0], during))

    def test_silver_always_unlocked(self):
        before = self.start - timedelta(hours=5)
        self.assertTrue(is_lesson_unlocked(self.silver, self.lessons[0], before))
        self.assertTrue(is_lesson_unlocked(self.silver, self.lessons[2], before))

    def test_reschedule_delays_taken(self):
        # Originally ends at 4:30; after end, taken.
        after_old_end = self.start + timedelta(minutes=91)
        self.assertEqual(
            len(lessons_taken_for_student(self.student_a, self.subject.id, after_old_end)),
            1,
        )
        # Reschedule to tomorrow — same clock no longer counts as taken
        self.session_a.start_time = self.start + timedelta(days=1)
        self.session_a.save(update_fields=["start_time"])
        self.assertEqual(
            len(lessons_taken_for_student(self.student_a, self.subject.id, after_old_end)),
            0,
        )

    def test_tasks_release_after_end_not_before_and_group_scoped(self):
        from assessments.models import HomeworkSubLesson, LessonCollectionLink

        HomeworkSubLesson.objects.create(
            lesson=self.lessons[0], title="واجب 1", order_number=1
        )
        LessonCollectionLink.objects.create(
            lesson=self.lessons[0],
            collection_lesson=self.lessons[0],
            order_number=1,
        )
        before_end = self.start + timedelta(minutes=30)
        after_end = self.start + timedelta(minutes=91)

        self.assertEqual(
            released_tasks_for_student(self.student_a, before_end, current_only=True),
            [],
        )
        a_tasks = released_tasks_for_student(
            self.student_a, after_end, current_only=True
        )
        self.assertGreaterEqual(len(a_tasks), 2)
        self.assertTrue(any(t["type"] == "homework" for t in a_tasks))
        self.assertTrue(any(t["type"] == "collection" for t in a_tasks))

        # Group B class not ended yet → no tasks for B
        self.assertEqual(
            released_tasks_for_student(self.student_b, after_end, current_only=True),
            [],
        )
