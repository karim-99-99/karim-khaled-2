from datetime import date, timedelta

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Lesson, Subject
from planner.generator import generate_plan_payload, reschedule_unfinished_payload
from planner.models import StudyPlan, StudyPlanTask


class StudyPlanGeneratorTests(TestCase):
    def setUp(self):
        self.math = Subject.objects.create(name="رياضيات", slug="m-plan", order=1)
        self.phys = Subject.objects.create(name="فيزياء", slug="p-plan", order=2)
        for i in range(1, 4):
            Lesson.objects.create(
                subject=self.math, title=f"م{i}", order_number=i
            )
            Lesson.objects.create(
                subject=self.phys, title=f"ف{i}", order_number=i
            )

    def test_packs_foundation_then_collections(self):
        payload = generate_plan_payload(
            subject_ids=[self.math.id, self.phys.id],
            days_count=40,
            hours_per_day=2,
            start_date=date.today(),
            include_foundation=True,
            include_collections=True,
        )
        self.assertIsNone(payload["error"])
        self.assertEqual(payload["total_units"], 12)  # 3+3 foundation + 3+3 collections
        all_tasks = [t for day in payload["days"].values() for t in day]
        kinds = [t["kind"] for t in all_tasks if t["kind"] != "review"]
        # First non-review content tasks should include foundation before collections finish.
        first_content = next(t for t in all_tasks if t["kind"] != "review")
        self.assertEqual(first_content["kind"], "foundation")
        self.assertTrue(any(k == "collections" for k in kinds))


class StudyPlanAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.subject = Subject.objects.create(name="رياضيات", slug="api-plan", order=1)
        for i in range(1, 5):
            Lesson.objects.create(
                subject=self.subject, title=f"درس {i}", order_number=i
            )
        self.student = User.objects.create_user(
            email="plan-s@test.local",
            password="Passw0rd!",
            full_name="S",
            role=User.Role.STUDENT,
        )

    def test_generate_toggle_and_active(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.post(
            "/api/study-plans/generate/",
            {
                "subject_ids": [self.subject.id],
                "days_count": 40,
                "hours_per_day": 2,
                "start_date": str(date.today()),
                "include_foundation": True,
                "include_collections": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data["is_active"])
        self.assertGreater(len(res.data["tasks"]), 0)
        plan_id = res.data["id"]
        task_id = res.data["tasks"][0]["id"]

        active = self.client.get("/api/study-plans/active/")
        self.assertEqual(active.status_code, 200)
        self.assertEqual(active.data["id"], plan_id)

        toggled = self.client.post(f"/api/study-plans/{plan_id}/tasks/{task_id}/toggle/")
        self.assertEqual(toggled.status_code, 200)
        self.assertTrue(toggled.data["is_done"])

        # Generating again deactivates previous.
        res2 = self.client.post(
            "/api/study-plans/generate/",
            {
                "subject_ids": [self.subject.id],
                "days_count": 50,
                "hours_per_day": 3,
                "start_date": str(date.today() + timedelta(days=1)),
            },
            format="json",
        )
        self.assertEqual(res2.status_code, 201)
        self.assertTrue(res2.data["is_active"])
        old = StudyPlan.objects.get(id=plan_id)
        self.assertFalse(old.is_active)

    def test_reschedule_packs_unfinished_into_remaining_days(self):
        self.client.force_authenticate(user=self.student)
        start = date.today() - timedelta(days=2)
        res = self.client.post(
            "/api/study-plans/generate/",
            {
                "subject_ids": [self.subject.id],
                "days_count": 40,
                "hours_per_day": 2,
                "start_date": str(start),
                "include_foundation": True,
                "include_collections": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        plan_id = res.data["id"]
        plan = StudyPlan.objects.get(id=plan_id)

        # Mark one early task done — must survive reschedule.
        first = (
            StudyPlanTask.objects.filter(plan=plan, kind="foundation")
            .order_by("day_index", "order_on_day")
            .first()
        )
        first.is_done = True
        first.save(update_fields=["is_done"])
        done_id = first.id
        unfinished_before = StudyPlanTask.objects.filter(plan=plan, is_done=False).count()
        self.assertGreater(unfinished_before, 0)

        # Overdue should be reported for days before today.
        active = self.client.get("/api/study-plans/active/")
        self.assertEqual(active.status_code, 200)
        self.assertGreaterEqual(active.data["overdue_count"], 0)
        self.assertEqual(active.data["today_day_index"], 3)

        r = self.client.post(f"/api/study-plans/{plan_id}/reschedule/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertGreater(r.data["rescheduled_units"], 0)
        self.assertTrue(StudyPlanTask.objects.filter(id=done_id, is_done=True).exists())

        # All unfinished tasks should sit on today..end (day_index >= 3).
        unfinished = StudyPlanTask.objects.filter(plan_id=plan_id, is_done=False)
        self.assertTrue(unfinished.exists())
        self.assertFalse(unfinished.filter(day_index__lt=3).exists())
        self.assertFalse(
            StudyPlanTask.objects.filter(plan_id=plan_id, is_done=False, day_index__gt=40).exists()
        )

    def test_reschedule_payload_helper(self):
        plan = StudyPlan.objects.create(
            student=self.student,
            title="t",
            start_date=date.today() - timedelta(days=1),
            days_count=10,
            hours_per_day=2,
            subject_ids=[self.subject.id],
            is_active=True,
        )
        lesson = Lesson.objects.filter(subject=self.subject).first()
        StudyPlanTask.objects.create(
            plan=plan,
            day_index=1,
            task_date=plan.start_date,
            kind="foundation",
            subject=self.subject,
            lesson=lesson,
            title="قديم",
            estimated_minutes=75,
            order_on_day=1,
            is_done=False,
        )
        StudyPlanTask.objects.create(
            plan=plan,
            day_index=1,
            task_date=plan.start_date,
            kind="review",
            title="مراجعة فارغة",
            estimated_minutes=45,
            order_on_day=2,
            is_done=False,
        )
        payload = reschedule_unfinished_payload(
            plan, from_day_index=2, from_date=date.today()
        )
        self.assertIsNone(payload["error"])
        self.assertEqual(payload["rescheduled_units"], 1)
        self.assertEqual(payload["remaining_days"], 9)
