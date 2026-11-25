from django.test import TestCase
from rest_framework.test import APIClient


class RemovedPlannerApiTests(TestCase):
    """Old planner endpoints stay gone. Class schedule is a different app."""

    def setUp(self):
        self.client = APIClient()

    def test_old_endpoints_are_not_found(self):
        paths = [
            "/api/study-plans/",
            "/api/study-plans/active/",
            "/api/study-plans/generate/",
            "/api/study-plans/1/",
            "/api/study-plans/1/tasks/1/toggle/",
        ]
        for path in paths:
            for method in ("get", "post", "delete"):
                res = getattr(self.client, method)(path, {}, format="json")
                self.assertEqual(res.status_code, 404, f"{method.upper()} {path}")
