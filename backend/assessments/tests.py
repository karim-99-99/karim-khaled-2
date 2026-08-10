from datetime import timedelta
from collections import Counter

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from assessments.models import CollectionQuestion, Exam, ExamAnswer
from assessments.views import DIFFICULTY_MIXES, _pick_mixed
from billing.models import Subscription
from catalog.models import Lesson, Subject
from groups.models import GroupStudent, StudyGroup


def _make_question(subject, lesson, teacher, difficulty, idx):
    return CollectionQuestion.objects.create(
        subject=subject,
        lesson=lesson,
        created_by=teacher,
        text=f"Q {difficulty} {idx}",
        options=[
            {"key": "أ", "text": "1"},
            {"key": "ب", "text": "2"},
            {"key": "ج", "text": "3"},
            {"key": "د", "text": "4"},
        ],
        correct_answer="أ",
        difficulty=difficulty,
        question_year="1446",
    )


class DifficultyMixUnitTests(TestCase):
    def setUp(self):
        self.subject = Subject.objects.create(
            name="رياضيات-مزج", slug="math-mix", order=1
        )
        self.teacher = User.objects.create_user(
            email="t-mix@test.local",
            password="Passw0rd!",
            full_name="T",
            role=User.Role.TEACHER,
        )
        self.lesson = Lesson.objects.create(
            subject=self.subject, title="درس", order_number=1, created_by=self.teacher
        )
        for i in range(60):
            _make_question(self.subject, self.lesson, self.teacher, "easy", i)
        for i in range(60):
            _make_question(self.subject, self.lesson, self.teacher, "medium", i)
        for i in range(60):
            _make_question(self.subject, self.lesson, self.teacher, "hard", i)

    def test_easy_mix_ratios_roughly(self):
        bank = CollectionQuestion.objects.filter(lesson=self.lesson)
        picked = _pick_mixed(bank, 100, "easy")
        self.assertEqual(len(picked), 100)
        c = Counter(q.difficulty for q in picked)
        # easy mix: 60/35/5 after normalize — allow ±8 for randomness/rounding
        self.assertGreaterEqual(c["easy"], 50)
        self.assertLessEqual(c["hard"], 15)

    def test_challenge_mix_prefers_hard(self):
        bank = CollectionQuestion.objects.filter(lesson=self.lesson)
        picked = _pick_mixed(bank, 100, "challenge")
        c = Counter(q.difficulty for q in picked)
        self.assertGreaterEqual(c["hard"], 40)
        self.assertLessEqual(c["easy"], 20)

    def test_medium_weights_normalize_over_100(self):
        raw = DIFFICULTY_MIXES["medium"]
        self.assertGreater(sum(raw.values()), 100)
        bank = CollectionQuestion.objects.filter(lesson=self.lesson)
        picked = _pick_mixed(bank, 20, "medium")
        self.assertEqual(len(picked), 20)


class SimulatorAPITests(TestCase):
    def setUp(self):
        self.subject = Subject.objects.create(
            name="رياضيات-محاكي", slug="math-sim", order=1
        )
        self.teacher = User.objects.create_user(
            email="t-sim@test.local",
            password="Passw0rd!",
            full_name="T",
            role=User.Role.TEACHER,
        )
        self.admin = User.objects.create_user(
            email="a-sim@test.local",
            password="Passw0rd!",
            full_name="A",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.lesson = Lesson.objects.create(
            subject=self.subject, title="درس 1", order_number=1, created_by=self.teacher
        )
        self.lesson2 = Lesson.objects.create(
            subject=self.subject, title="درس 2", order_number=2, created_by=self.teacher
        )
        for i in range(15):
            _make_question(self.subject, self.lesson, self.teacher, "easy", i)
            _make_question(self.subject, self.lesson, self.teacher, "medium", i)
            _make_question(self.subject, self.lesson, self.teacher, "hard", i)
        for i in range(10):
            _make_question(self.subject, self.lesson2, self.teacher, "medium", i)

        self.group = StudyGroup.objects.create(name="SimG", created_by=self.admin)
        self.student = User.objects.create_user(
            email="s-sim@test.local",
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
        self.free = User.objects.create_user(
            email="f-sim@test.local",
            password="Passw0rd!",
            full_name="F",
            role=User.Role.STUDENT,
        )
        GroupStudent.objects.create(group=self.group, student=self.free)
        self.client = APIClient()

    def test_requires_subject_and_lessons(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.post("/api/exams/simulator/", {}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_start_with_difficulty_mix(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.post(
            "/api/exams/simulator/",
            {
                "subjects": [self.subject.id],
                "lessons": [self.lesson.id],
                "count": 20,
                "difficulty_mix": "advanced",
                "review_mode": "final",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        exam = res.data["exam"]
        self.assertEqual(exam["question_count"], 20)
        self.assertEqual(exam["review_mode"], "final")
        self.assertIn("متقدم", exam.get("title") or "")

    def test_free_tier_blocks_non_first_lesson(self):
        self.client.force_authenticate(user=self.free)
        res = self.client.post(
            "/api/exams/simulator/",
            {
                "subjects": [self.subject.id],
                "lessons": [self.lesson2.id],
                "count": 5,
                "difficulty_mix": "easy",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_free_tier_caps_question_count(self):
        self.client.force_authenticate(user=self.free)
        res = self.client.post(
            "/api/exams/simulator/",
            {
                "subjects": [self.subject.id],
                "lessons": [self.lesson.id],
                "count": 50,
                "difficulty_mix": "medium",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertLessEqual(res.data["exam"]["question_count"], 10)

    def test_options_returns_lessons_and_years(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.get(
            f"/api/exams/simulator/options/?subjects={self.subject.id}"
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(len(res.data["lessons"]) >= 2)
        self.assertIn("1446", res.data["years"])

    def test_heavy_bulk_exam_create(self):
        """Create a large exam quickly via mix take-all path."""
        for i in range(80):
            _make_question(self.subject, self.lesson, self.teacher, "easy", 1000 + i)
        self.client.force_authenticate(user=self.student)
        import time

        t0 = time.perf_counter()
        res = self.client.post(
            "/api/exams/simulator/",
            {
                "subjects": [self.subject.id],
                "lessons": [self.lesson.id],
                "take_all": True,
                "difficulty_mix": "challenge",
                "review_mode": "immediate",
            },
            format="json",
        )
        elapsed = time.perf_counter() - t0
        self.assertEqual(res.status_code, 201, res.data)
        exam = res.data["exam"]
        self.assertGreater(exam["question_count"], 50)
        self.assertEqual(
            ExamAnswer.objects.filter(exam_id=exam["id"]).count(),
            exam["question_count"],
        )
        self.assertLess(elapsed, 5.0, f"simulator start too slow: {elapsed:.2f}s")

    def test_finish_partial_exam(self):
        self.client.force_authenticate(user=self.student)
        start = self.client.post(
            "/api/exams/simulator/",
            {
                "subjects": [self.subject.id],
                "lessons": [self.lesson.id],
                "count": 5,
                "difficulty_mix": "easy",
                "review_mode": "final",
            },
            format="json",
        )
        self.assertEqual(start.status_code, 201, start.data)
        exam_id = start.data["exam"]["id"]
        questions = start.data.get("questions") or []
        if questions:
            aid = questions[0]["answer_id"]
            self.client.post(
                f"/api/exams/{exam_id}/answer/",
                {"answer_id": aid, "selected": "أ"},
                format="json",
            )
        finish = self.client.post(f"/api/exams/{exam_id}/finish/", {}, format="json")
        self.assertIn(finish.status_code, (200, 201))
        exam = Exam.objects.get(id=exam_id)
        self.assertIn(exam.status, (Exam.Status.FINISHED, Exam.Status.AUTO_SUBMITTED))
