from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from assessments.models import CollectionQuestion, HomeworkQuestion
from billing.models import Subscription
from catalog.models import Lesson, Subject
from groups.models import GroupStudent, GroupTeacher, StudyGroup
from scheduling.models import Session

SUBJECTS = [
    ("رياضيات", "math", "linear-gradient(135deg,#1e40af,#3b82f6)"),
    ("فيزياء", "physics", "linear-gradient(135deg,#7c3aed,#a78bfa)"),
    ("كيمياء", "chemistry", "linear-gradient(135deg,#059669,#34d399)"),
    ("أحياء", "biology", "linear-gradient(135deg,#d97706,#fbbf24)"),
]

LESSONS = ["المعادلات الخطية", "حل المعادلات", "تطبيقات عملية"]


class Command(BaseCommand):
    help = "Seed demo data: subjects, users, a group, lessons and questions."

    def handle(self, *args, **options):
        # Subjects
        subjects = {}
        for i, (name, slug, grad) in enumerate(SUBJECTS):
            s, _ = Subject.objects.get_or_create(
                slug=slug, defaults={"name": name, "cover_gradient": grad, "order": i}
            )
            subjects[slug] = s
        math = subjects["math"]

        # Users
        admin = self._user("admin@platform.test", "مدير المنصة", "01000000001", User.Role.ADMIN, staff=True, superuser=True)
        teacher = self._user("teacher@platform.test", "الأستاذ أحمد", "01000000002", User.Role.TEACHER)
        student = self._user("student@platform.test", "طالب مشترك", "01000000003", User.Role.STUDENT)
        free_student = self._user("free@platform.test", "طالب بدون اشتراك", "01000000004", User.Role.STUDENT)

        # Active subscription for the subscribed student
        if not student.subscriptions.exists():
            Subscription.objects.create(
                student=student,
                plan=Subscription.Plan.YEARLY,
                start_date=timezone.now().date(),
                end_date=timezone.now().date() + timedelta(days=198),
            )

        # Group with teacher (math) + both students
        group, _ = StudyGroup.objects.get_or_create(
            name="مجموعة الصف الثالث - أ", defaults={"created_by": admin}
        )
        GroupTeacher.objects.get_or_create(group=group, teacher=teacher, subject=math)
        GroupStudent.objects.get_or_create(group=group, student=student)
        GroupStudent.objects.get_or_create(group=group, student=free_student)

        # Lessons (shared per subject)
        lessons = []
        for i, title in enumerate(LESSONS, start=1):
            lesson, _ = Lesson.objects.get_or_create(
                subject=math,
                order_number=i,
                defaults={"title": title, "is_free_preview": i == 1},
            )
            lessons.append(lesson)

        # Collection questions (group-scoped) across difficulties
        difficulties = ["easy", "medium", "hard"]
        created = 0
        for lesson in lessons:
            for d in difficulties:
                existing = CollectionQuestion.objects.filter(
                    group=group, lesson=lesson, difficulty=d
                ).count()
                for n in range(existing, 6):  # ensure at least 6 per difficulty
                    idx = n + 1
                    CollectionQuestion.objects.create(
                        group=group,
                        subject=math,
                        lesson=lesson,
                        created_by=teacher,
                        difficulty=d,
                        text=f"({d}) ما ناتج تكامل الدالة $f(x) = {idx}x$ ؟",
                        options=[
                            {"key": "أ", "text": f"$\\frac{{{idx}x^2}}{{2}} + C$"},
                            {"key": "ب", "text": f"${idx}x^2 + C$"},
                            {"key": "ج", "text": f"${idx}x + C$"},
                            {"key": "د", "text": "$x^2 + C$"},
                        ],
                        correct_answer="أ",
                        written_correction="نستخدم قاعدة تكامل القوى.",
                        video_timing=CollectionQuestion.VideoTiming.AFTER,
                        free_order=(idx if d == "medium" and idx <= 10 else None),
                    )
                    created += 1

        # One homework question on lesson 1
        if not HomeworkQuestion.objects.filter(group=group).exists():
            HomeworkQuestion.objects.create(
                group=group,
                subject=math,
                lesson=lessons[0],
                created_by=teacher,
                text="حل المعادلة $2x + 4 = 10$",
                options=[
                    {"key": "أ", "text": "$x = 2$"},
                    {"key": "ب", "text": "$x = 3$"},
                    {"key": "ج", "text": "$x = 4$"},
                    {"key": "د", "text": "$x = 5$"},
                ],
                correct_answer="ب",
                video_timing=HomeworkQuestion.VideoTiming.BEFORE,
            )

        # Sessions today + tomorrow
        now = timezone.now()
        if not Session.objects.exists():
            Session.objects.create(
                subject=math, group=group, teacher=teacher, teacher_name="الأستاذ أحمد",
                start_time=now + timedelta(hours=2), duration_minutes=60,
                status=Session.Status.LIVE, zoom_link="https://zoom.us/j/example",
            )
            Session.objects.create(
                subject=subjects["physics"], teacher_name="الأستاذة سارة",
                start_time=now + timedelta(days=1, hours=1), duration_minutes=45,
                status=Session.Status.SCHEDULED, zoom_link="https://zoom.us/j/example2",
            )

        self.stdout.write(self.style.SUCCESS(
            f"Seeded. Collection questions created this run: {created}"
        ))
        self.stdout.write("Demo logins (password: Passw0rd!):")
        self.stdout.write("  admin@platform.test / teacher@platform.test / student@platform.test / free@platform.test")

    def _user(self, email, name, phone, role, staff=False, superuser=False):
        user = User.objects.filter(email=email).first()
        if user:
            return user
        user = User.objects.create_user(
            email=email, password="Passw0rd!", full_name=name, phone=phone, role=role
        )
        user.is_staff = staff
        user.is_superuser = superuser
        user.save()
        return user
