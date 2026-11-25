from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Lesson, Subject
from catalog.themes import theme_key_for


class ThemeKeyTests(TestCase):
    def test_slug_and_name_map_to_the_four_themes(self):
        self.assertEqual(theme_key_for("biology", "أحياء"), "bio")
        self.assertEqual(theme_key_for("chemistry", "كيمياء"), "chem")
        self.assertEqual(theme_key_for("physics", ""), "physics")
        self.assertEqual(theme_key_for("math-reorder", "رياضيات-ترتيب"), "math")
        self.assertEqual(theme_key_for("extra", "مادة جديدة"), "")



class LessonReorderDeleteTests(TestCase):
    def setUp(self):
        self.subject = Subject.objects.create(
            name="رياضيات-ترتيب", slug="math-reorder", order=1
        )
        self.teacher = User.objects.create_user(
            email="t-re@test.local",
            password="Passw0rd!",
            full_name="T",
            role=User.Role.TEACHER,
            taught_subject=self.subject,
        )
        self.lessons = [
            Lesson.objects.create(
                subject=self.subject,
                title=f"L{i}",
                order_number=i,
                created_by=self.teacher,
            )
            for i in range(1, 5)
        ]
        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)

    def test_reorder(self):
        ids = [self.lessons[2].id, self.lessons[0].id, self.lessons[1].id, self.lessons[3].id]
        res = self.client.post(
            "/api/lessons/reorder/",
            {"subject": self.subject.id, "ordered_ids": ids},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        ordered = list(
            Lesson.objects.filter(subject=self.subject, is_archived=False)
            .order_by("order_number")
            .values_list("id", flat=True)
        )
        self.assertEqual(ordered, ids)

    def test_delete(self):
        lid = self.lessons[1].id
        res = self.client.delete(f"/api/lessons/{lid}/")
        self.assertIn(res.status_code, (204, 200))
        self.assertFalse(Lesson.objects.filter(id=lid).exists())
