from decimal import Decimal

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from billing.models import Payment


@override_settings(
    SUBSCRIPTION_CURRENCY="SAR",
    SUBSCRIPTION_PRICES={"silver": "190", "gold": "990"},
    SUBSCRIPTION_DAYS={"silver": 365, "gold": 365},
)
class SubscriptionPricingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student = User.objects.create_user(
            email="student-pricing@test.local",
            password="Passw0rd!",
            full_name="طالب",
            role=User.Role.STUDENT,
        )

    def test_plans_are_public_and_priced(self):
        res = self.client.get("/api/subscription/plans/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["currency"], "SAR")
        self.assertFalse(res.data["auto_renew"])
        by_id = {p["id"]: p for p in res.data["plans"]}
        self.assertEqual(set(by_id), {"silver", "gold"})
        self.assertEqual(by_id["silver"]["price"], "190.00")
        self.assertEqual(by_id["gold"]["price"], "990.00")
        self.assertEqual(by_id["gold"]["days"], 365)
        self.assertEqual(by_id["gold"]["currency"], "SAR")
        self.assertFalse(by_id["gold"]["auto_renew"])
        self.assertTrue(by_id["gold"]["live_classes"])
        self.assertFalse(by_id["silver"]["live_classes"])

    def test_checkout_records_the_listed_price(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.post(
            "/api/subscription/checkout/",
            {"plan": "silver", "method": "card"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        payment = Payment.objects.get(student=self.student)
        self.assertEqual(payment.amount, Decimal("190.00"))
        self.assertEqual(payment.plan, "silver")
        self.assertEqual(payment.status, Payment.Status.SUCCESS)

    def test_unknown_plan_is_rejected(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.post(
            "/api/subscription/checkout/", {"plan": "yearly"}, format="json"
        )
        self.assertEqual(res.status_code, 400)
