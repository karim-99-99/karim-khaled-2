from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from assessments.models import (
    HomeworkQuestion,
    HomeworkSubLesson,
    LessonCollectionLink,
    StudentPracticeAnswer,
)
from billing.models import Subscription
from catalog.models import Lesson, Subject
from groups.models import GroupStudent, GroupTeacher, StudyGroup
from scheduling.models import Session


class DailyTasksPageAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.subject = Subject.objects.create(name="كيمياء-يومية", slug="chem-daily", order=1)
        self.admin = User.objects.create_user(
            email="a-daily@test.local",
            password="Passw0rd!",
            full_name="A",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.teacher = User.objects.create_user(
            email="t-daily@test.local",
            password="Passw0rd!",
            full_name="T",
            role=User.Role.TEACHER,
        )
        self.student = User.objects.create_user(
            email="s-daily@test.local",
            password="Passw0rd!",
            full_name="S",
            role=User.Role.STUDENT,
        )
        self.silver = User.objects.create_user(
            email="sil-daily@test.local",
            password="Passw0rd!",
            full_name="Sil",
            role=User.Role.STUDENT,
        )
        today = timezone.now().date()
        Subscription.objects.create(
            student=self.student,
            plan=Subscription.Plan.GOLD,
            start_date=today,
            end_date=today + timedelta(days=30),
        )
        Subscription.objects.create(
            student=self.silver,
            plan=Subscription.Plan.SILVER,
            start_date=today,
            end_date=today + timedelta(days=30),
        )
        self.group = StudyGroup.objects.create(name="DailyG", created_by=self.admin)
        GroupTeacher.objects.create(
            group=self.group, teacher=self.teacher, subject=self.subject
        )
        GroupStudent.objects.create(group=self.group, student=self.student)
        self.lesson = Lesson.objects.create(
            subject=self.subject, title="اتزان", order_number=1, created_by=self.admin
        )
        self.hw = HomeworkSubLesson.objects.create(
            lesson=self.lesson, title="واجب اتزان", order_number=1
        )
        self.qs = []
        for i in range(2):
            self.qs.append(
                HomeworkQuestion.objects.create(
                    subject=self.subject,
                    lesson=self.lesson,
                    homework_sub_lesson=self.hw,
                    created_by=self.admin,
                    text=f"س{i}",
                    options=[
                        {"key": "أ", "text": "1"},
                        {"key": "ب", "text": "2"},
                    ],
                    correct_answer="أ",
                    difficulty="easy",
                    order_number=i + 1,
                )
            )
        LessonCollectionLink.objects.create(
            lesson=self.lesson,
            collection_lesson=self.lesson,
            order_number=1,
        )
        start = timezone.now() - timedelta(hours=3)
        self.session = Session.objects.create(
            subject=self.subject,
            group=self.group,
            teacher=self.teacher,
            title="حصة",
            session_type=Session.SessionType.FOUNDATION,
            start_time=start,
            duration_minutes=60,
            lesson=self.lesson,
        )

    def test_silver_forbidden_gold_sees_tasks_completion(self):
        self.client.force_authenticate(user=self.silver)
        denied = self.client.get("/api/daily-tasks/")
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(user=self.student)
        page = self.client.get("/api/daily-tasks/")
        self.assertEqual(page.status_code, 200, page.data)
        self.assertGreaterEqual(page.data["today_total"], 1)
        hw = next(
            (t for t in page.data["today_tasks"] if t["type"] == "homework"), None
        )
        self.assertIsNotNone(hw)
        self.assertFalse(hw["is_done"])

        # Answer only one question → still not done
        a1 = self.client.post(
            "/api/practice-answers/",
            {
                "kind": "homework",
                "question_id": self.qs[0].id,
                "selected_answer": "أ",
            },
            format="json",
        )
        self.assertEqual(a1.status_code, 200, a1.data)
        page2 = self.client.get("/api/daily-tasks/")
        hw2 = next(t for t in page2.data["today_tasks"] if t["type"] == "homework")
        self.assertFalse(hw2["is_done"])

        # Answer all → done
        self.client.post(
            "/api/practice-answers/",
            {
                "kind": "homework",
                "question_id": self.qs[1].id,
                "selected_answer": "ب",
            },
            format="json",
        )
        page3 = self.client.get("/api/daily-tasks/")
        hw3 = next(t for t in page3.data["today_tasks"] if t["type"] == "homework")
        self.assertTrue(hw3["is_done"])
        self.assertEqual(
            StudentPracticeAnswer.objects.filter(student=self.student).count(), 2
        )

    def test_streak_breaks_on_late_day(self):
        from assessments.daily_tasks import _day_status, _streak

        today = timezone.localdate()
        # Build synthetic day map: 3 complete, 1 late, 1 complete
        def bucket(done_on_time, total=2):
            tasks = []
            for i in range(total):
                tasks.append(
                    {
                        "is_done": i < done_on_time or done_on_time == total,
                        "on_time": True if done_on_time == total else (i < done_on_time),
                    }
                )
            # simplify: all done on time OR none
            if done_on_time == total:
                tasks = [{"is_done": True, "on_time": True} for _ in range(total)]
            elif done_on_time == 0:
                tasks = [{"is_done": False, "on_time": False} for _ in range(total)]
            else:
                tasks = [{"is_done": True, "on_time": True} for _ in range(done_on_time)]
                tasks += [
                    {"is_done": False, "on_time": False}
                    for _ in range(total - done_on_time)
                ]
            return {"tasks": tasks}

        days = {
            today - timedelta(days=4): bucket(2),
            today - timedelta(days=3): bucket(2),
            today - timedelta(days=2): bucket(2),
            today - timedelta(days=1): bucket(0),  # late
            today: bucket(2),
        }
        # streak should be 1 (today complete) — late yesterday breaks earlier chain
        self.assertEqual(_streak(days, today), 1)
        st, done, total = _day_status(days[today - timedelta(days=1)], is_today=False)
        self.assertEqual(st, "late")
