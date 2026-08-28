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


# ---------------------------------------------------------------------------
# استيراد الأسئلة من ملف Word / نصي
# ---------------------------------------------------------------------------

SAMPLE_TXT = """
تعليمات — هذا السطر يُتجاهل لأنه قبل أول س:

س: ما ناتج $2x + 3 = 7$؟
أ) 1
ب) 2 *
ج) 3
د) 4
السنة: 1446
الصعوبة: سهل
الشرح: ننقل ثم نقسم

س: سؤال بدون إجابة محددة؟
أ) خيار أول
ب) خيار ثانٍ
الصعوبة: غريبة

س: سؤال ناقص الخيارات؟
أ) خيار وحيد

س: سؤال بسطر الإجابة؟
أ) أول
ب) ثانٍ
ج) ثالث
الإجابة: ج
"""


class QuestionImportParserTests(TestCase):
    def test_parse_defaults_and_rejects(self):
        from assessments.question_import import parse_question_blocks

        questions, errors = parse_question_blocks(SAMPLE_TXT.splitlines())
        self.assertEqual(len(questions), 3)
        self.assertEqual(len(errors), 1)
        self.assertIn("الخيارات", errors[0]["reason"])

        q1, q2, q3 = questions
        # Complete question — star answer, no review needed.
        self.assertEqual(q1["correct_answer"], "ب")
        self.assertEqual(q1["difficulty"], "easy")
        self.assertEqual(q1["question_year"], "1446")
        self.assertFalse(q1["needs_review"])

        # Missing answer → default أ + review; odd difficulty → medium + review.
        self.assertEqual(q2["correct_answer"], "أ")
        self.assertEqual(q2["difficulty"], "medium")
        self.assertTrue(q2["needs_review"])
        self.assertIn("إجابة", q2["review_notes"])

        # الإجابة: line style.
        self.assertEqual(q3["correct_answer"], "ج")
        self.assertFalse(q3["needs_review"])

    def test_docx_with_word_equation(self):
        import io
        import zipfile

        from assessments.question_import import extract_docx_lines, parse_question_blocks

        math = (
            '<m:oMath><m:f><m:num><m:r><m:t>1</m:t></m:r></m:num>'
            "<m:den><m:r><m:t>2</m:t></m:r></m:den></m:f></m:oMath>"
        )

        def p(text):
            return f'<w:p><w:r><w:t xml:space="preserve">{text}</w:t></w:r></w:p>'

        doc = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
            'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>'
            + f'<w:p><w:r><w:t xml:space="preserve">س: ما ناتج </w:t></w:r>{math}'
            + '<w:r><w:t xml:space="preserve"> ؟</w:t></w:r></w:p>'
            + p("أ) نصف *")
            + p("ب) ربع")
            + "</w:body></w:document>"
        )
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("word/document.xml", doc)
        buf.seek(0)

        lines = extract_docx_lines(buf)
        questions, errors = parse_question_blocks(lines)
        self.assertEqual(errors, [])
        self.assertEqual(len(questions), 1)
        self.assertIn("$\\frac{1}{2}$", questions[0]["text"])
        self.assertEqual(questions[0]["correct_answer"], "أ")


class QuestionImportAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.subject = Subject.objects.create(name="فيزياء-استيراد", slug="ph-imp", order=1)
        self.admin = User.objects.create_user(
            email="a-imp@test.local",
            password="Passw0rd!",
            full_name="A",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.lesson = Lesson.objects.create(
            subject=self.subject, title="درس استيراد", order_number=1, created_by=self.admin
        )
        self.student = User.objects.create_user(
            email="s-imp@test.local",
            password="Passw0rd!",
            full_name="S",
            role=User.Role.STUDENT,
        )
        Subscription.objects.create(
            student=self.student,
            plan=Subscription.Plan.MONTHLY,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )

    def _upload(self, mode):
        from django.core.files.uploadedfile import SimpleUploadedFile

        file = SimpleUploadedFile(
            "questions.txt", SAMPLE_TXT.encode("utf-8"), content_type="text/plain"
        )
        return self.client.post(
            "/api/collection-questions/import/",
            {"file": file, "lesson": self.lesson.id, "mode": mode},
            format="multipart",
        )

    def test_preview_does_not_save(self):
        self.client.force_authenticate(user=self.admin)
        res = self._upload("preview")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["summary"]["ready"], 2)
        self.assertEqual(res.data["summary"]["needs_review"], 1)
        self.assertEqual(res.data["summary"]["rejected"], 1)
        self.assertEqual(CollectionQuestion.objects.count(), 0)

    def test_commit_saves_and_hides_unreviewed_from_students(self):
        self.client.force_authenticate(user=self.admin)
        res = self._upload("commit")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["created"], 3)
        self.assertEqual(
            CollectionQuestion.objects.filter(needs_review=True).count(), 1
        )

        # Student simulator: only the 2 reviewed questions are reachable.
        self.client.force_authenticate(user=self.student)
        start = self.client.post(
            "/api/exams/simulator/",
            {
                "subjects": [self.subject.id],
                "lessons": [self.lesson.id],
                "take_all": True,
                "levels": ["easy", "medium", "hard"],
            },
            format="json",
        )
        self.assertEqual(start.status_code, 201, start.data)
        self.assertEqual(len(start.data["questions"]), 2)

        # Teacher approves the flagged question → becomes visible.
        flagged = CollectionQuestion.objects.get(needs_review=True)
        self.client.force_authenticate(user=self.admin)
        patch = self.client.patch(
            f"/api/collection-questions/{flagged.id}/",
            {"needs_review": False, "review_notes": ""},
            format="json",
        )
        self.assertEqual(patch.status_code, 200, patch.data)

        self.client.force_authenticate(user=self.student)
        start2 = self.client.post(
            "/api/exams/simulator/",
            {
                "subjects": [self.subject.id],
                "lessons": [self.lesson.id],
                "take_all": True,
                "levels": ["easy", "medium", "hard"],
            },
            format="json",
        )
        self.assertEqual(start2.status_code, 201, start2.data)
        self.assertEqual(len(start2.data["questions"]), 3)

    def test_student_cannot_import(self):
        self.client.force_authenticate(user=self.student)
        res = self._upload("commit")
        self.assertEqual(res.status_code, 403)


class HomeworkImportAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.subject = Subject.objects.create(name="كيم-استيراد", slug="chem-hw", order=1)
        self.admin = User.objects.create_user(
            email="a-hw@test.local",
            password="Passw0rd!",
            full_name="A",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.lesson = Lesson.objects.create(
            subject=self.subject, title="درس تأسيس", order_number=1, created_by=self.admin
        )
        from catalog.models import LessonSection

        self.section = LessonSection.objects.create(
            lesson=self.lesson, title="حصة 1", order_number=1
        )
        self.student = User.objects.create_user(
            email="s-hw@test.local",
            password="Passw0rd!",
            full_name="S",
            role=User.Role.STUDENT,
        )
        self.group = StudyGroup.objects.create(name="HwG", created_by=self.admin)
        GroupStudent.objects.create(group=self.group, student=self.student)
        from groups.models import GroupTeacher

        GroupTeacher.objects.create(
            group=self.group, teacher=self.admin, subject=self.subject
        )
        Subscription.objects.create(
            student=self.student,
            plan=Subscription.Plan.MONTHLY,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )

    def _upload(self, mode):
        from django.core.files.uploadedfile import SimpleUploadedFile

        file = SimpleUploadedFile(
            "homework.txt", SAMPLE_TXT.encode("utf-8"), content_type="text/plain"
        )
        return self.client.post(
            "/api/homework-questions/import/",
            {
                "file": file,
                "lesson": self.lesson.id,
                "section": self.section.id,
                "mode": mode,
            },
            format="multipart",
        )

    def test_commit_hides_unreviewed_from_students(self):
        self.client.force_authenticate(user=self.admin)
        res = self._upload("commit")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["created"], 3)

        self.client.force_authenticate(user=self.student)
        hw = self.client.get(f"/api/my-homework/?section={self.section.id}")
        self.assertEqual(hw.status_code, 200)
        self.assertEqual(len(hw.data), 2)
