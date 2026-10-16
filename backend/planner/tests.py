from datetime import date, timedelta

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Lesson, Subject
from planner.generator import generate_plan_payload
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
