from decimal import Decimal

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from billing.models import Payment


@override_settings(
    SUBSCRIPTION_CURRENCY="SAR",
    SUBSCRIPTION_PRICES={"monthly": "99", "quarterly": "249", "yearly": "799"},
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
        self.assertEqual(set(by_id), {"monthly", "quarterly", "yearly"})
        self.assertEqual(by_id["monthly"]["price"], "99.00")
        self.assertEqual(by_id["yearly"]["days"], 365)
        self.assertEqual(by_id["yearly"]["currency"], "SAR")
        self.assertFalse(by_id["yearly"]["auto_renew"])

    def test_checkout_records_the_listed_price(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.post(
            "/api/subscription/checkout/",
            {"plan": "quarterly", "method": "card"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        payment = Payment.objects.get(student=self.student)
        self.assertEqual(payment.amount, Decimal("249.00"))
        self.assertEqual(payment.plan, "quarterly")
        self.assertEqual(payment.status, Payment.Status.SUCCESS)
