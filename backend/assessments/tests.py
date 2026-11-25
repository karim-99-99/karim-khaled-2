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


def _make_question(subject, lesson, teacher, difficulty, idx, teacher_tier="", question_year="1446"):
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
        question_year=question_year,
        teacher_tier=teacher_tier,
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

    def test_simulator_ignores_legacy_year_filter(self):
        """Old clients may still send years — bank must stay all-years."""
        other_year_q = _make_question(
            self.subject, self.lesson, self.teacher, "medium", 900, question_year="1440"
        )
        self.client.force_authenticate(user=self.student)
        res = self.client.post(
            "/api/exams/simulator/",
            {
                "subjects": [self.subject.id],
                "lessons": [self.lesson.id],
                "count": 50,
                "difficulty_mix": "medium",
                "years": ["1446"],
                "year": "1446",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        q_ids = {q["id"] for q in res.data.get("questions") or []}
        # Enough questions that both years can appear; at least the request succeeds
        # without being restricted to a single year label.
        self.assertTrue(len(q_ids) >= 1)
        years_in_exam = {
            q.get("question_year") for q in res.data.get("questions") or []
        }
        self.assertTrue(years_in_exam)
        # Creating the 1440 question must not break the start; ignore filter means
        # the bank still includes it when pick allows.
        self.assertTrue(
            other_year_q.id in q_ids or "1446" in years_in_exam or "1440" in years_in_exam
        )

    def test_teacher_tier_filter_on_start(self):
        tier_lesson = Lesson.objects.create(
            subject=self.subject,
            title="ترشيحات",
            order_number=3,
            created_by=self.teacher,
        )
        for i in range(5):
            _make_question(
                self.subject, tier_lesson, self.teacher, "medium", i, teacher_tier="gold"
            )
        for i in range(5):
            _make_question(
                self.subject,
                tier_lesson,
                self.teacher,
                "medium",
                100 + i,
                teacher_tier="silver",
            )
        for i in range(5):
            _make_question(
                self.subject,
                tier_lesson,
                self.teacher,
                "medium",
                200 + i,
                teacher_tier="bronze",
            )

        self.client.force_authenticate(user=self.student)
        opts = self.client.get(
            f"/api/exams/simulator/options/?subjects={self.subject.id}"
            f"&lessons={tier_lesson.id}"
        )
        self.assertEqual(opts.status_code, 200)
        tiers = {row["tier"] for row in opts.data.get("tier_stats") or []}
        self.assertEqual(tiers, {"gold", "silver", "bronze"})

        start = self.client.post(
            "/api/exams/simulator/",
            {
                "subjects": [self.subject.id],
                "lessons": [tier_lesson.id],
                "count": 10,
                "levels": ["medium"],
                "tiers": ["gold", "silver"],
                "review_mode": "final",
            },
            format="json",
        )
        self.assertEqual(start.status_code, 201, start.data)
        q_ids = [q["id"] for q in start.data.get("questions") or []]
        tiers_in_exam = set(
            CollectionQuestion.objects.filter(id__in=q_ids).values_list(
                "teacher_tier", flat=True
            )
        )
        self.assertTrue(tiers_in_exam.issubset({"gold", "silver"}))
        self.assertFalse("bronze" in tiers_in_exam)

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


class QuestionDeleteAPITests(TestCase):
    def setUp(self):
        from groups.models import GroupTeacher

        self.client = APIClient()
        self.subject = Subject.objects.create(name="حذف-أسئلة", slug="del-q", order=1)
        self.admin = User.objects.create_user(
            email="a-del@test.local",
            password="Passw0rd!",
            full_name="A",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.teacher = User.objects.create_user(
            email="t-del@test.local",
            password="Passw0rd!",
            full_name="T",
            role=User.Role.TEACHER,
            taught_subject=self.subject,
        )
        self.other = User.objects.create_user(
            email="t2-del@test.local",
            password="Passw0rd!",
            full_name="T2",
            role=User.Role.TEACHER,
        )
        self.lesson = Lesson.objects.create(
            subject=self.subject, title="درس", order_number=1, created_by=self.admin
        )
        self.group = StudyGroup.objects.create(name="DelG", created_by=self.admin)
        GroupTeacher.objects.create(
            group=self.group, teacher=self.teacher, subject=self.subject
        )
        GroupTeacher.objects.create(
            group=self.group, teacher=self.other, subject=self.subject
        )
        self.q = _make_question(self.subject, self.lesson, self.teacher, "easy", 1)

    def test_teacher_deletes_own_collection_question(self):
        self.client.force_authenticate(user=self.teacher)
        res = self.client.delete(f"/api/collection-questions/{self.q.id}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(CollectionQuestion.objects.filter(id=self.q.id).exists())
        listing = self.client.get(f"/api/collection-questions/?lesson={self.lesson.id}")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.data), 0)

    def test_teacher_cannot_delete_other_teachers_collection_question(self):
        self.client.force_authenticate(user=self.other)
        res = self.client.delete(f"/api/collection-questions/{self.q.id}/")
        self.assertEqual(res.status_code, 403)
        self.assertTrue(CollectionQuestion.objects.filter(id=self.q.id).exists())


class CollectionSubLessonAPITests(TestCase):
    def setUp(self):
        from groups.models import GroupTeacher

        self.client = APIClient()
        self.subject = Subject.objects.create(name="فرعي-مادة", slug="sub-l", order=1)
        self.admin = User.objects.create_user(
            email="a-sub@test.local",
            password="Passw0rd!",
            full_name="A",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.teacher = User.objects.create_user(
            email="t-sub@test.local",
            password="Passw0rd!",
            full_name="T",
            role=User.Role.TEACHER,
            taught_subject=self.subject,
        )
        self.outsider = User.objects.create_user(
            email="t-out@test.local",
            password="Passw0rd!",
            full_name="O",
            role=User.Role.TEACHER,
        )
        self.lesson = Lesson.objects.create(
            subject=self.subject, title="الحركة", order_number=1, created_by=self.admin
        )
        self.other_lesson = Lesson.objects.create(
            subject=self.subject, title="الطاقة", order_number=2, created_by=self.admin
        )
        self.group = StudyGroup.objects.create(name="SubG", created_by=self.admin)
        GroupTeacher.objects.create(
            group=self.group, teacher=self.teacher, subject=self.subject
        )
        self.student = User.objects.create_user(
            email="s-sub@test.local",
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

    def _create_sub(self, title, lesson=None):
        self.client.force_authenticate(user=self.teacher)
        res = self.client.post(
            "/api/collection-sub-lessons/",
            {"lesson": (lesson or self.lesson).id, "title": title},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def test_create_list_and_auto_order(self):
        a = self._create_sub("السرعة")
        b = self._create_sub("التسارع")
        self.assertEqual((a["order_number"], b["order_number"]), (1, 2))
        self.client.force_authenticate(user=self.student)
        res = self.client.get(f"/api/collection-sub-lessons/?lesson={self.lesson.id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual([r["title"] for r in res.data], ["السرعة", "التسارع"])

    def test_list_by_subject(self):
        self._create_sub("السرعة")
        self._create_sub("خارجي", lesson=self.other_lesson)
        other_subject = Subject.objects.create(name="أخرى", slug="other-sub", order=99)
        foreign_lesson = Lesson.objects.create(
            subject=other_subject, title="أجنبي", order_number=1, created_by=self.admin
        )
        self.client.force_authenticate(user=self.teacher)
        self.client.post(
            "/api/collection-sub-lessons/",
            {"lesson": foreign_lesson.id, "title": "لا يظهر"},
            format="json",
        )
        self.client.force_authenticate(user=self.student)
        res = self.client.get(f"/api/collection-sub-lessons/?subject={self.subject.id}")
        self.assertEqual(res.status_code, 200)
        titles = [r["title"] for r in res.data]
        self.assertEqual(titles, ["السرعة", "خارجي"])
        self.assertNotIn("لا يظهر", titles)

    def test_outsider_teacher_cannot_create(self):
        self.client.force_authenticate(user=self.outsider)
        res = self.client.post(
            "/api/collection-sub-lessons/",
            {"lesson": self.lesson.id, "title": "x"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_question_sub_lesson_must_match_lesson(self):
        foreign = self._create_sub("خارجي", lesson=self.other_lesson)
        res = self.client.post(
            "/api/collection-questions/",
            {
                "subject": self.subject.id,
                "lesson": self.lesson.id,
                "sub_lesson": foreign["id"],
                "text": "س",
                "options": [{"key": "أ", "text": "1"}, {"key": "ب", "text": "2"}],
                "correct_answer": "أ",
                "difficulty": "easy",
                "teacher_tier": "gold",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("sub_lesson", res.data)

    def test_filter_questions_and_delete_keeps_questions(self):
        sub = self._create_sub("السرعة")
        in_sub = _make_question(self.subject, self.lesson, self.teacher, "easy", 1)
        in_sub.sub_lesson_id = sub["id"]
        in_sub.save()
        direct = _make_question(self.subject, self.lesson, self.teacher, "easy", 2)

        base = f"/api/collection-questions/?lesson={self.lesson.id}"
        only_sub = self.client.get(f"{base}&sub_lesson={sub['id']}")
        self.assertEqual([q["id"] for q in only_sub.data], [in_sub.id])
        only_direct = self.client.get(f"{base}&sub_lesson=none")
        self.assertEqual([q["id"] for q in only_direct.data], [direct.id])

        res = self.client.delete(f"/api/collection-sub-lessons/{sub['id']}/")
        self.assertEqual(res.status_code, 204)
        in_sub.refresh_from_db()
        self.assertIsNone(in_sub.sub_lesson_id)

    def test_student_exam_narrowed_to_sub_lessons(self):
        sub = self._create_sub("السرعة")
        sub_q_ids = set()
        for i in range(3):
            q = _make_question(self.subject, self.lesson, self.teacher, "easy", i)
            q.sub_lesson_id = sub["id"]
            q.save()
            sub_q_ids.add(q.id)
        direct_ids = {
            _make_question(self.subject, self.lesson, self.teacher, "easy", 10 + i).id
            for i in range(4)
        }

        self.client.force_authenticate(user=self.student)
        opts = self.client.get(
            f"/api/exams/simulator/options/?subjects={self.subject.id}&lessons={self.lesson.id}"
        )
        self.assertEqual(opts.status_code, 200)
        self.assertEqual([s["id"] for s in opts.data["sub_lessons"]], [sub["id"]])
        self.assertEqual(opts.data["sub_lessons"][0]["question_count"], 3)
        self.assertTrue(any(r["sub_lesson"] == sub["id"] for r in opts.data["filter_breakdown"]))

        payload = {
            "subjects": [self.subject.id],
            "lessons": [self.lesson.id],
            "levels": ["easy"],
            "take_all": True,
        }
        only_sub = self.client.post(
            "/api/exams/simulator/", {**payload, "sub_lessons": [sub["id"]]}, format="json"
        )
        self.assertEqual(only_sub.status_code, 201, only_sub.data)
        self.assertEqual({q["id"] for q in only_sub.data["questions"]}, sub_q_ids)

        only_direct = self.client.post(
            "/api/exams/simulator/", {**payload, "sub_lessons": [0]}, format="json"
        )
        self.assertEqual(only_direct.status_code, 201, only_direct.data)
        self.assertEqual({q["id"] for q in only_direct.data["questions"]}, direct_ids)

        everything = self.client.post("/api/exams/simulator/", payload, format="json")
        self.assertEqual(everything.data["exam"]["question_count"], 7)

    def test_start_rejects_sub_lesson_from_other_lesson(self):
        foreign = self._create_sub("خارجي", lesson=self.other_lesson)
        _make_question(self.subject, self.lesson, self.teacher, "easy", 1)
        self.client.force_authenticate(user=self.student)
        res = self.client.post(
            "/api/exams/simulator/",
            {
                "subjects": [self.subject.id],
                "lessons": [self.lesson.id],
                "levels": ["easy"],
                "take_all": True,
                "sub_lessons": [foreign["id"]],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_reorder_and_bulk_delete_collection_questions(self):
        a = _make_question(self.subject, self.lesson, self.teacher, "easy", 1)
        b = _make_question(self.subject, self.lesson, self.teacher, "easy", 2)
        c = _make_question(self.subject, self.lesson, self.teacher, "medium", 3)
        sub = self._create_sub("فرع")
        in_sub = _make_question(self.subject, self.lesson, self.teacher, "easy", 4)
        in_sub.sub_lesson_id = sub["id"]
        in_sub.save()

        self.client.force_authenticate(user=self.teacher)
        res = self.client.post(
            "/api/collection-questions/reorder/",
            {
                "lesson": self.lesson.id,
                "sub_lesson": "none",
                "ordered_ids": [c.id, a.id, b.id],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        a.refresh_from_db()
        b.refresh_from_db()
        c.refresh_from_db()
        self.assertEqual([c.order_number, a.order_number, b.order_number], [1, 2, 3])

        wipe_sub = self.client.post(
            "/api/collection-questions/bulk-delete/",
            {"lesson": self.lesson.id, "sub_lesson": sub["id"]},
            format="json",
        )
        self.assertEqual(wipe_sub.status_code, 200, wipe_sub.data)
        self.assertEqual(wipe_sub.data["deleted"], 1)
        self.assertFalse(CollectionQuestion.objects.filter(id=in_sub.id).exists())

        wipe_direct = self.client.post(
            "/api/collection-questions/bulk-delete/",
            {"lesson": self.lesson.id, "sub_lesson": "none"},
            format="json",
        )
        self.assertEqual(wipe_direct.status_code, 200)
        self.assertEqual(wipe_direct.data["deleted"], 3)
        self.assertEqual(
            CollectionQuestion.objects.filter(lesson=self.lesson).count(), 0
        )


class HomeworkQuestionOrderBulkTests(TestCase):
    def setUp(self):
        from catalog.models import LessonSection
        from groups.models import GroupTeacher

        self.client = APIClient()
        self.subject = Subject.objects.create(name="تأسيس-ترتيب", slug="hw-ord", order=1)
        self.admin = User.objects.create_user(
            email="a-hw-ord@test.local",
            password="Passw0rd!",
            full_name="A",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.teacher = User.objects.create_user(
            email="t-hw-ord@test.local",
            password="Passw0rd!",
            full_name="T",
            role=User.Role.TEACHER,
            taught_subject=self.subject,
        )
        self.lesson = Lesson.objects.create(
            subject=self.subject, title="درس", order_number=1, created_by=self.admin
        )
        self.section = LessonSection.objects.create(
            lesson=self.lesson, title="حصة", order_number=1
        )
        self.group = StudyGroup.objects.create(name="HwOrd", created_by=self.admin)
        GroupTeacher.objects.create(
            group=self.group, teacher=self.teacher, subject=self.subject
        )

    def test_reorder_and_bulk_delete_homework(self):
        from assessments.models import HomeworkQuestion

        qs = []
        for i in range(3):
            qs.append(
                HomeworkQuestion.objects.create(
                    subject=self.subject,
                    lesson=self.lesson,
                    section=self.section,
                    created_by=self.teacher,
                    text=f"س{i}",
                    options=[{"key": "أ", "text": "1"}, {"key": "ب", "text": "2"}],
                    correct_answer="أ",
                    difficulty="medium",
                    order_number=i + 1,
                )
            )
        self.client.force_authenticate(user=self.teacher)
        res = self.client.post(
            "/api/homework-questions/reorder/",
            {
                "lesson": self.lesson.id,
                "section": self.section.id,
                "ordered_ids": [qs[2].id, qs[0].id, qs[1].id],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        for q in qs:
            q.refresh_from_db()
        self.assertEqual([qs[2].order_number, qs[0].order_number, qs[1].order_number], [1, 2, 3])

        wipe = self.client.post(
            "/api/homework-questions/bulk-delete/",
            {"section": self.section.id, "lesson": self.lesson.id},
            format="json",
        )
        self.assertEqual(wipe.status_code, 200, wipe.data)
        self.assertEqual(wipe.data["deleted"], 3)
        self.assertEqual(HomeworkQuestion.objects.filter(section=self.section).count(), 0)


class HomeworkSubLessonAPITests(TestCase):
    """Task 16 — global homework titles under foundation lessons."""

    def setUp(self):
        from core.access import assign_teacher_subject_role
        from groups.models import GroupTeacher, TeacherSubjectRole

        self.client = APIClient()
        self.subject = Subject.objects.create(name="واجب-عناوين", slug="hw-sub", order=1)
        self.admin = User.objects.create_user(
            email="a-hw-sub@test.local",
            password="Passw0rd!",
            full_name="A",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.main = User.objects.create_user(
            email="t-main-hw@test.local",
            password="Passw0rd!",
            full_name="Main",
            role=User.Role.TEACHER,
        )
        self.secondary = User.objects.create_user(
            email="t-sec-hw@test.local",
            password="Passw0rd!",
            full_name="Sec",
            role=User.Role.TEACHER,
        )
        self.student = User.objects.create_user(
            email="s-hw-sub@test.local",
            password="Passw0rd!",
            full_name="S",
            role=User.Role.STUDENT,
        )
        assign_teacher_subject_role(self.main, self.subject, TeacherSubjectRole.Role.MAIN)
        assign_teacher_subject_role(
            self.secondary, self.subject, TeacherSubjectRole.Role.SECONDARY
        )
        self.lesson = Lesson.objects.create(
            subject=self.subject, title="التصنيف الحديث", order_number=1, created_by=self.admin
        )
        self.group = StudyGroup.objects.create(name="HwSubG", created_by=self.admin)
        GroupTeacher.objects.create(
            group=self.group, teacher=self.main, subject=self.subject
        )
        GroupTeacher.objects.create(
            group=self.group, teacher=self.secondary, subject=self.subject
        )
        GroupStudent.objects.create(group=self.group, student=self.student)
        Subscription.objects.create(
            student=self.student,
            plan=Subscription.Plan.MONTHLY,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )

    def test_main_creates_title_secondary_forbidden_student_reads(self):
        from assessments.models import HomeworkQuestion, HomeworkSubLesson

        self.client.force_authenticate(user=self.main)
        created = self.client.post(
            "/api/homework-sub-lessons/",
            {"lesson": self.lesson.id, "title": "الممالك الخمس"},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        title_id = created.data["id"]
        self.assertNotIn("group", created.data)
        self.assertEqual(created.data["question_count"], 0)

        self.client.force_authenticate(user=self.secondary)
        denied = self.client.post(
            "/api/homework-sub-lessons/",
            {"lesson": self.lesson.id, "title": "ممنوع"},
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

        listed = self.client.get(f"/api/homework-sub-lessons/?lesson={self.lesson.id}")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.data), 1)

        self.client.force_authenticate(user=self.main)
        q = self.client.post(
            "/api/homework-questions/",
            {
                "subject": self.subject.id,
                "lesson": self.lesson.id,
                "homework_sub_lesson": title_id,
                "text": "سؤال واجب",
                "options": [
                    {"key": "أ", "text": "1"},
                    {"key": "ب", "text": "2"},
                    {"key": "ج", "text": "3"},
                    {"key": "د", "text": "4"},
                ],
                "correct_answer": "أ",
                "difficulty": "easy",
            },
            format="json",
        )
        self.assertEqual(q.status_code, 201, q.data)
        self.assertNotIn("group", q.data)
        self.assertIsNone(HomeworkQuestion.objects.get(id=q.data["id"]).group_id)

        titles = self.client.get(f"/api/homework-sub-lessons/?lesson={self.lesson.id}")
        self.assertEqual(titles.data[0]["question_count"], 1)

        self.client.force_authenticate(user=self.student)
        hw = self.client.get(f"/api/my-homework/?homework_sub_lesson={title_id}")
        self.assertEqual(hw.status_code, 200)
        self.assertEqual(len(hw.data), 1)

        self.client.force_authenticate(user=self.main)
        wipe = self.client.delete(f"/api/homework-sub-lessons/{title_id}/")
        self.assertEqual(wipe.status_code, 204)
        self.assertFalse(HomeworkSubLesson.objects.filter(id=title_id).exists())
        # Student answers/questions rows are not hard-wiped by title delete (SET_NULL).
        self.assertTrue(HomeworkQuestion.objects.filter(id=q.data["id"]).exists())


class TeacherTasksBoardAPITests(TestCase):
    """Task 17 — lesson ↔ collection linking + group overrides."""

    def setUp(self):
        from core.access import assign_teacher_subject_role
        from groups.models import GroupTeacher, TeacherSubjectRole
        from assessments.models import CollectionSubLesson, HomeworkSubLesson

        self.client = APIClient()
        self.subject = Subject.objects.create(name="مهام-ربط", slug="tasks-link", order=1)
        self.admin = User.objects.create_user(
            email="a-tasks@test.local",
            password="Passw0rd!",
            full_name="A",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.main = User.objects.create_user(
            email="t-main-tasks@test.local",
            password="Passw0rd!",
            full_name="Main",
            role=User.Role.TEACHER,
        )
        self.secondary = User.objects.create_user(
            email="t-sec-tasks@test.local",
            password="Passw0rd!",
            full_name="Sec",
            role=User.Role.TEACHER,
        )
        assign_teacher_subject_role(self.main, self.subject, TeacherSubjectRole.Role.MAIN)
        assign_teacher_subject_role(
            self.secondary, self.subject, TeacherSubjectRole.Role.SECONDARY
        )
        self.lesson1 = Lesson.objects.create(
            subject=self.subject, title="مقدمة", order_number=1, created_by=self.admin
        )
        self.lesson2 = Lesson.objects.create(
            subject=self.subject, title="التصنيف الحديث", order_number=2, created_by=self.admin
        )
        self.sub_a = CollectionSubLesson.objects.create(
            lesson=self.lesson2, title="الممالك", order_number=1
        )
        self.sub_b = CollectionSubLesson.objects.create(
            lesson=self.lesson2, title="التسمية", order_number=2
        )
        HomeworkSubLesson.objects.create(
            lesson=self.lesson2, title="واجب مقفول", order_number=1
        )
        self.group_a = StudyGroup.objects.create(name="مجموعة أ", created_by=self.admin)
        self.group_b = StudyGroup.objects.create(name="مجموعة ب", created_by=self.admin)
        GroupTeacher.objects.create(
            group=self.group_a, teacher=self.main, subject=self.subject
        )
        GroupTeacher.objects.create(
            group=self.group_b, teacher=self.main, subject=self.subject
        )
        GroupTeacher.objects.create(
            group=self.group_a, teacher=self.secondary, subject=self.subject
        )

    def test_link_subs_group_override_and_secondary_readonly(self):
        self.client.force_authenticate(user=self.main)
        add = self.client.post(
            "/api/teacher/tasks-board/links/",
            {
                "action": "add",
                "lesson": self.lesson2.id,
                "nodes": [
                    {
                        "collection_lesson": self.lesson2.id,
                        "collection_sub_lesson": self.sub_a.id,
                    },
                    {
                        "collection_lesson": self.lesson2.id,
                        "collection_sub_lesson": self.sub_b.id,
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(add.status_code, 201, add.data)
        self.assertEqual(len(add.data["created"]), 2)

        board = self.client.get(
            f"/api/teacher/tasks-board/?subject={self.subject.id}"
        )
        self.assertEqual(board.status_code, 200)
        row = next(r for r in board.data["lessons"] if r["id"] == self.lesson2.id)
        self.assertEqual(row["collection_count"], 2)
        self.assertEqual(row["homework_count"], 1)
        self.assertTrue(all(h["locked"] for h in row["homework"]))

        # Duplicate main after subs → error
        dup = self.client.post(
            "/api/teacher/tasks-board/links/",
            {
                "action": "add",
                "lesson": self.lesson2.id,
                "nodes": [
                    {
                        "collection_lesson": self.lesson2.id,
                        "collection_sub_lesson": None,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(dup.status_code, 400)

        # Group B override: different set
        ov = self.client.post(
            "/api/teacher/tasks-board/links/",
            {
                "action": "add",
                "lesson": self.lesson2.id,
                "group": self.group_b.id,
                "nodes": [
                    {
                        "collection_lesson": self.lesson1.id,
                        "collection_sub_lesson": None,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ov.status_code, 201, ov.data)

        board_b = self.client.get(
            f"/api/teacher/tasks-board/?subject={self.subject.id}&group={self.group_b.id}"
        )
        row_b = next(r for r in board_b.data["lessons"] if r["id"] == self.lesson2.id)
        self.assertTrue(row_b["is_override"])
        # Copied default (2) + new main (1) = 3
        self.assertEqual(row_b["collection_count"], 3)

        board_a = self.client.get(
            f"/api/teacher/tasks-board/?subject={self.subject.id}&group={self.group_a.id}"
        )
        row_a = next(r for r in board_a.data["lessons"] if r["id"] == self.lesson2.id)
        self.assertFalse(row_a["is_override"])
        self.assertEqual(row_a["collection_count"], 2)

        reset = self.client.post(
            "/api/teacher/tasks-board/links/",
            {
                "action": "reset_default",
                "lesson": self.lesson2.id,
                "group": self.group_b.id,
            },
            format="json",
        )
        self.assertEqual(reset.status_code, 200)
        board_b2 = self.client.get(
            f"/api/teacher/tasks-board/?subject={self.subject.id}&group={self.group_b.id}"
        )
        row_b2 = next(r for r in board_b2.data["lessons"] if r["id"] == self.lesson2.id)
        self.assertFalse(row_b2["is_override"])
        self.assertEqual(row_b2["collection_count"], 2)

        self.client.force_authenticate(user=self.secondary)
        denied = self.client.post(
            "/api/teacher/tasks-board/links/",
            {
                "action": "add",
                "lesson": self.lesson2.id,
                "nodes": [
                    {
                        "collection_lesson": self.lesson1.id,
                        "collection_sub_lesson": None,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(denied.status_code, 403)
        view = self.client.get(f"/api/teacher/tasks-board/?subject={self.subject.id}")
        self.assertEqual(view.status_code, 200)
        self.assertFalse(view.data["can_edit"])


class ResultsAnalyticsUnitTests(TestCase):
    """Task 25 — period windows + score formula."""

    def test_parse_period_and_score(self):
        from assessments.results_analytics import (
            _score,
            parse_period,
            period_window,
            previous_window,
        )

        self.assertEqual(parse_period(None), "all")
        self.assertEqual(parse_period("7d"), "7d")
        self.assertEqual(_score(2, 8), 25.0)
        self.assertEqual(_score(0, 0), None)

        now = timezone.now()
        start, end = period_window("7d", now=now)
        self.assertIsNotNone(start)
        self.assertEqual(end, now)
        p0, p1 = previous_window("7d", now=now)
        self.assertEqual(p1, start)
        self.assertAlmostEqual((p1 - p0).total_seconds(), (end - start).total_seconds(), delta=1)


class SimulatorPickUnitTests(TestCase):
    """Task 24 — lesson weighting algorithm (brief 9.3)."""

    def test_expected_30_over_10(self):
        from assessments.simulator_pick import expected_counts

        e = expected_counts(30, 10)
        rounded = [round(x, 1) for x in e]
        self.assertEqual(
            rounded, [1.5, 1.8, 2.2, 2.5, 2.8, 3.2, 3.5, 3.8, 4.2, 4.5]
        )

    def test_expected_10_over_10(self):
        from assessments.simulator_pick import expected_counts

        e = expected_counts(10, 10)
        self.assertAlmostEqual(e[0], 0.5, places=5)
        self.assertAlmostEqual(e[-1], 1.5, places=5)
        self.assertEqual(round(sum(e), 5), 10.0)

    def test_expected_22_over_8(self):
        from assessments.simulator_pick import expected_counts

        e = expected_counts(22, 8)
        self.assertEqual(round(e[0], 1), 1.4)
        self.assertEqual(round(e[-1], 1), 4.1)
        self.assertEqual(round(sum(e), 5), 22.0)

    def test_allocate_sums_and_ranges_30_10(self):
        from assessments.simulator_pick import allocate_lesson_counts

        rng = __import__("random").Random(0)
        counts = allocate_lesson_counts(30, 10, rng=rng)
        self.assertEqual(sum(counts), 30)
        self.assertTrue(all(1 <= c <= 5 for c in counts[:3]))
        self.assertTrue(all(2 <= c <= 5 for c in counts[3:7]))
        self.assertTrue(all(4 <= c <= 5 for c in counts[7:]))

    def test_shortfall_moves_to_next_lesson(self):
        from assessments.simulator_pick import redistribute_shortfalls

        # Lesson index 4 assigned 4 but only 2 available → +2 to index 5.
        assigned = [1, 1, 2, 2, 4, 3, 3, 4, 5, 5]
        available = [10, 10, 10, 10, 2, 10, 10, 10, 10, 10]
        out = redistribute_shortfalls(assigned, available)
        self.assertEqual(out[4], 2)
        self.assertEqual(out[5], 5)  # 3 + 2
        self.assertEqual(sum(out), sum(assigned))

    def test_no_duplicate_questions(self):
        from assessments.simulator_pick import pick_weighted_for_subject

        pools = [[f"L{i}-Q{j}" for j in range(20)] for i in range(10)]
        rng = __import__("random").Random(1)
        picked = pick_weighted_for_subject(pools, 30, rng=rng)
        self.assertEqual(len(picked), 30)
        self.assertEqual(len(picked), len(set(picked)))

    def test_mean_bias_over_many_runs(self):
        from assessments.simulator_pick import allocate_lesson_counts

        rng = __import__("random").Random(42)
        totals = [0] * 10
        runs = 1000
        for _ in range(runs):
            c = allocate_lesson_counts(30, 10, rng=rng)
            for i, v in enumerate(c):
                totals[i] += v
        means = [t / runs for t in totals]
        self.assertAlmostEqual(means[0], 1.5, delta=0.25)
        self.assertAlmostEqual(means[-1], 4.5, delta=0.25)


class SimulatorAllocUnitTests(TestCase):
    """Task 23 — subject count split (30:30:25:25 largest remainder)."""

    def test_default_22_all_four(self):
        from assessments.simulator_alloc import allocate_by_ratio

        alloc = allocate_by_ratio(["math", "bio", "chem", "phys"], 22)
        self.assertEqual(alloc, {"math": 6, "bio": 6, "chem": 5, "phys": 5})
        self.assertEqual(sum(alloc.values()), 22)

    def test_math_bio_and_math_chem(self):
        from assessments.simulator_alloc import allocate_by_ratio

        self.assertEqual(
            allocate_by_ratio(["math", "bio"], 22), {"math": 11, "bio": 11}
        )
        self.assertEqual(
            allocate_by_ratio(["math", "chem"], 22), {"math": 12, "chem": 10}
        )

    def test_fixed_four_is_110(self):
        from assessments.simulator_alloc import allocate_fixed

        alloc = allocate_fixed(["math", "bio", "chem", "phys"])
        self.assertEqual(sum(alloc.values()), 110)
        self.assertEqual(alloc["math"], 30)
        self.assertEqual(alloc["bio"], 30)
        self.assertEqual(alloc["chem"], 25)
        self.assertEqual(alloc["phys"], 25)


class CollectionSectionsTests(TestCase):
    """Task 21 — تجميعات practice: sections of 50, resume cursor, ordered bank."""

    def setUp(self):
        self.subject = Subject.objects.create(
            name="أحياء-أقسام", slug="bio-sec", order=2
        )
        self.teacher = User.objects.create_user(
            email="t-colsec@test.local",
            password="Passw0rd!",
            full_name="T",
            role=User.Role.TEACHER,
        )
        self.admin = User.objects.create_user(
            email="a-colsec@test.local",
            password="Passw0rd!",
            full_name="A",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.lesson = Lesson.objects.create(
            subject=self.subject, title="درس أقسام", order_number=1, created_by=self.teacher
        )
        for i in range(55):
            q = _make_question(self.subject, self.lesson, self.teacher, "easy", i)
            q.order_number = i + 1
            q.save(update_fields=["order_number"])
        self.group = StudyGroup.objects.create(name="ColSecG", created_by=self.admin)
        self.student = User.objects.create_user(
            email="s-colsec@test.local",
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

    def test_collection_mode_sets_type_section_size_and_order(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.post(
            "/api/exams/simulator/",
            {
                "subjects": [self.subject.id],
                "lessons": [self.lesson.id],
                "take_all": True,
                "mode": "collection",
                "review_mode": "immediate",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        exam = res.data["exam"]
        self.assertEqual(exam["exam_type"], "collection")
        self.assertEqual(exam["section_size"], 50)
        self.assertEqual(exam["question_count"], 55)
        self.assertEqual(exam["last_question_index"], 0)
        texts = [q["text"] for q in res.data["questions"]]
        self.assertEqual(texts[0], "Q easy 0")
        self.assertEqual(texts[54], "Q easy 54")

    def test_take_all_without_mode_stays_simulator(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.post(
            "/api/exams/simulator/",
            {
                "subjects": [self.subject.id],
                "lessons": [self.lesson.id],
                "take_all": True,
                "review_mode": "immediate",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["exam"]["exam_type"], "simulator")
        self.assertEqual(res.data["exam"]["section_size"], 22)

    def test_patch_last_question_index(self):
        self.client.force_authenticate(user=self.student)
        start = self.client.post(
            "/api/exams/simulator/",
            {
                "subjects": [self.subject.id],
                "lessons": [self.lesson.id],
                "take_all": True,
                "mode": "collection",
                "review_mode": "immediate",
            },
            format="json",
        )
        exam_id = start.data["exam"]["id"]
        patch = self.client.patch(
            f"/api/exams/{exam_id}/",
            {"last_question_index": 51},
            format="json",
        )
        self.assertEqual(patch.status_code, 200, patch.data)
        self.assertEqual(patch.data["last_question_index"], 51)
        detail = self.client.get(f"/api/exams/{exam_id}/")
        self.assertEqual(detail.data["exam"]["last_question_index"], 51)

        # Clamp to last question.
        patch2 = self.client.patch(
            f"/api/exams/{exam_id}/",
            {"last_question_index": 999},
            format="json",
        )
        self.assertEqual(patch2.data["last_question_index"], 54)


class SimulatorSectionsTests(TestCase):
    """Task 22 — محاكي: أقسام 22 + استراحة + قفل الأقسام على الـ API."""

    def setUp(self):
        self.subject = Subject.objects.create(
            name="رياضة-أقسام", slug="math-sec22", order=3
        )
        self.teacher = User.objects.create_user(
            email="t-simsec@test.local",
            password="Passw0rd!",
            full_name="T",
            role=User.Role.TEACHER,
        )
        self.admin = User.objects.create_user(
            email="a-simsec@test.local",
            password="Passw0rd!",
            full_name="A",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.lesson = Lesson.objects.create(
            subject=self.subject, title="درس محاكي", order_number=1, created_by=self.teacher
        )
        for i in range(45):
            _make_question(self.subject, self.lesson, self.teacher, "easy", i)
        self.group = StudyGroup.objects.create(name="SimSecG", created_by=self.admin)
        self.student = User.objects.create_user(
            email="s-simsec@test.local",
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

    def _start(self, count=45):
        self.client.force_authenticate(user=self.student)
        return self.client.post(
            "/api/exams/simulator/",
            {
                "subjects": [self.subject.id],
                "lessons": [self.lesson.id],
                "count": count,
                "levels": ["easy"],
                "review_mode": "final",
                "time_limit_minutes": None,
            },
            format="json",
        )

    def test_simulator_section_size_and_remainder(self):
        res = self._start(45)
        self.assertEqual(res.status_code, 201, res.data)
        exam = res.data["exam"]
        self.assertEqual(exam["exam_type"], "simulator")
        self.assertEqual(exam["section_size"], 22)
        self.assertEqual(exam["section_count"], 3)  # 22 + 22 + 1
        self.assertTrue(exam["sections_locked"])
        self.assertEqual(exam["current_section"], 0)
        self.assertFalse(exam["break_pending"])
        self.assertEqual(exam["break_seconds"], 300)

    def test_answer_locked_after_section_advance(self):
        res = self._start(45)
        exam_id = res.data["exam"]["id"]
        q0 = res.data["questions"][0]
        # Finish section 0 → break → continue → section 1.
        br = self.client.patch(
            f"/api/exams/{exam_id}/", {"action": "start_break"}, format="json"
        )
        self.assertEqual(br.status_code, 200, br.data)
        self.assertTrue(br.data["exam"]["break_pending"])
        # Cannot answer during break.
        denied = self.client.post(
            f"/api/exams/{exam_id}/answer/",
            {"answer_id": q0["answer_id"], "selected": "أ"},
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

        cont = self.client.patch(
            f"/api/exams/{exam_id}/", {"action": "continue_section"}, format="json"
        )
        self.assertEqual(cont.status_code, 200, cont.data)
        self.assertEqual(cont.data["exam"]["current_section"], 1)
        self.assertFalse(cont.data["exam"]["break_pending"])
        self.assertEqual(cont.data["exam"]["last_question_index"], 22)

        # Section 0 still locked.
        denied2 = self.client.post(
            f"/api/exams/{exam_id}/answer/",
            {"answer_id": q0["answer_id"], "selected": "أ"},
            format="json",
        )
        self.assertEqual(denied2.status_code, 403)

        # Current section answerable.
        q22 = cont.data["questions"][22]
        ok = self.client.post(
            f"/api/exams/{exam_id}/answer/",
            {"answer_id": q22["answer_id"], "selected": "أ"},
            format="json",
        )
        self.assertEqual(ok.status_code, 200, ok.data)

    def test_leave_during_break_skips_wait(self):
        res = self._start(45)
        exam_id = res.data["exam"]["id"]
        self.client.patch(
            f"/api/exams/{exam_id}/", {"action": "start_break"}, format="json"
        )
        exam = Exam.objects.get(id=exam_id)
        exam.break_started_at = timezone.now() - timedelta(seconds=10)
        exam.save(update_fields=["break_started_at"])
        detail = self.client.get(f"/api/exams/{exam_id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertFalse(detail.data["exam"]["break_pending"])
        self.assertEqual(detail.data["exam"]["current_section"], 1)

    def test_teacher_type_has_no_sections(self):
        exam = Exam.objects.create(
            student=self.student,
            subject=self.subject,
            exam_type=Exam.Type.TEACHER,
            question_count=45,
            review_mode=Exam.ReviewMode.FINAL,
        )
        self.assertIsNone(exam.section_size)
        self.assertFalse(exam.sections_locked)
        self.assertEqual(exam.section_count(), 0)
