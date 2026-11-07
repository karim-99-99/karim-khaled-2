
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from assessments.models import (
    MAX_QUESTION_FOLDERS,
    CollectionQuestion,
    QuestionFolder,
    QuestionFolderItem,
)
from billing.models import Subscription
from catalog.models import Lesson, Subject
from groups.models import GroupStudent, StudyGroup


def _q(subject, lesson, teacher, i):
    return CollectionQuestion.objects.create(
        subject=subject,
        lesson=lesson,
        created_by=teacher,
        text=f"سؤال مهم {i}",
        options=[{"key": "أ", "text": "1"}, {"key": "ب", "text": "2"}],
        correct_answer="أ",
        difficulty="medium",
        question_year="1446",
    )


class QuestionFolderAPITests(TestCase):
    def setUp(self):
        self.math = Subject.objects.create(name="رياضيات-ملفات", slug="fold-m", order=1)
        self.phys = Subject.objects.create(name="فيزياء-ملفات", slug="fold-p", order=2)
        self.teacher = User.objects.create_user(
            email="t-fold@test.local",
            password="Passw0rd!",
            full_name="T",
            role=User.Role.TEACHER,
        )
        self.admin = User.objects.create_user(
            email="a-fold@test.local",
            password="Passw0rd!",
            full_name="A",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.lm = Lesson.objects.create(
            subject=self.math, title="م1", order_number=1, created_by=self.teacher
        )
        self.lp = Lesson.objects.create(
            subject=self.phys, title="ف1", order_number=1, created_by=self.teacher
        )
        self.qm = [_q(self.math, self.lm, self.teacher, i) for i in range(3)]
        self.qp = [_q(self.phys, self.lp, self.teacher, i) for i in range(2)]
        self.group = StudyGroup.objects.create(name="FoldG", created_by=self.admin)
        self.student = User.objects.create_user(
            email="s-fold@test.local",
            password="Passw0rd!",
            full_name="S",
            role=User.Role.STUDENT,
        )
        GroupStudent.objects.create(group=self.group, student=self.student)
        Subscription.objects.create(
            student=self.student,
            plan=Subscription.Plan.MONTHLY,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.student)

    def test_create_save_group_by_subject_and_practice(self):
        res = self.client.post("/api/question-folders/", {"name": "أسئلة مهمة"}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        folder_id = res.data["id"]

        for q in self.qm + self.qp:
            add = self.client.post(
                f"/api/question-folders/{folder_id}/items/",
                {"question_id": q.id},
                format="json",
            )
            self.assertIn(add.status_code, (200, 201), add.data)

        detail = self.client.get(f"/api/question-folders/{folder_id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["question_count"], 5)
        self.assertEqual(detail.data["subject_count"], 2)
        names = [g["subject_name"] for g in detail.data["subjects"]]
        self.assertEqual(names, ["رياضيات-ملفات", "فيزياء-ملفات"])

        mem = self.client.get(f"/api/question-folders/membership/?question={self.qm[0].id}")
        self.assertEqual(mem.status_code, 200)
        self.assertIn(folder_id, mem.data["folder_ids"])

        practice = self.client.post(
            f"/api/question-folders/{folder_id}/practice/",
            {"subject_id": self.math.id, "review_mode": "immediate"},
            format="json",
        )
        self.assertEqual(practice.status_code, 201, practice.data)
        self.assertEqual(practice.data["exam"]["question_count"], 3)

        # Cap at 20 folders
        for i in range(MAX_QUESTION_FOLDERS - 1):
            r = self.client.post(
                "/api/question-folders/", {"name": f"ملف {i}"}, format="json"
            )
            self.assertEqual(r.status_code, 201, r.data)
        over = self.client.post("/api/question-folders/", {"name": "زيادة"}, format="json")
        self.assertEqual(over.status_code, 400)
