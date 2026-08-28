from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.telegram_views import telegram_complete, telegram_start, telegram_status
from accounts.views import (
    LoginView,
    MeView,
    RegisterView,
    admin_accounts,
    available_students,
    change_password,
    delete_user,
    set_teacher_subject,
    set_user_active,
    set_user_password,
    set_user_role,
    teacher_list,
)
from assessments.views import (
    AnswerView,
    CollectionQuestionViewSet,
    ImportCollectionQuestionsView,
    ImportHomeworkQuestionsView,
    ExamDetailView,
    ExamReviewView,
    FinishView,
    HomeworkQuestionViewSet,
    MyResultsView,
    StartSimulatorView,
    StartTeacherTestView,
    StudentHomeworkView,
    TeacherTestViewSet,
    simulator_options,
)
from billing.views import (
    AdminPaymentViewSet,
    AdminSubscriptionViewSet,
    admin_grant_subscription,
    checkout,
    my_subscription,
)
from catalog.views import LessonSectionViewSet, LessonViewSet, SubjectViewSet
from core.views import (
    health,
    home_free_content,
    next_session,
    teacher_assignments,
    teacher_student_analytics,
    video_token,
)
from groups.views import AdminGroupViewSet, TeacherGroupViewSet
from scheduling.views import SessionViewSet

router = DefaultRouter()
router.register("subjects", SubjectViewSet, basename="subject")
router.register("lessons", LessonViewSet, basename="lesson")
router.register("lesson-sections", LessonSectionViewSet, basename="lesson-section")
router.register("sessions", SessionViewSet, basename="session")
router.register("homework-questions", HomeworkQuestionViewSet, basename="homework")
router.register("collection-questions", CollectionQuestionViewSet, basename="collection")
router.register("admin/groups", AdminGroupViewSet, basename="admin-group")
router.register("teacher/groups", TeacherGroupViewSet, basename="teacher-group")
router.register("admin/subscriptions", AdminSubscriptionViewSet, basename="admin-sub")
router.register("admin/payments", AdminPaymentViewSet, basename="admin-payment")

api_patterns = [
    # Auth
    path("auth/register/", RegisterView.as_view()),
    path("auth/login/", LoginView.as_view()),
    path("auth/refresh/", TokenRefreshView.as_view()),
    path("auth/me/", MeView.as_view()),
    path("auth/change-password/", change_password),
    path("auth/telegram/status/", telegram_status),
    path("auth/telegram/start/", telegram_start),
    path("auth/telegram/callback/", telegram_complete),
    path("auth/telegram/complete/", telegram_complete),
    # Public / video
    path("health/", health),
    path("home/free-content/", home_free_content),
    path("home/next-session/", next_session),
    path("videos/<str:bunny_id>/token/", video_token),
    # Admin user management
    path("admin/accounts/", admin_accounts),
    path("admin/available-students/", available_students),
    path("admin/teachers/", teacher_list),
    path("admin/users/<int:user_id>/set-active/", set_user_active),
    path("admin/users/<int:user_id>/set-role/", set_user_role),
    path("admin/users/<int:user_id>/set-subject/", set_teacher_subject),
    path("admin/users/<int:user_id>/set-password/", set_user_password),
    path("admin/users/<int:user_id>/delete/", delete_user),
    path("admin/users/<int:user_id>/grant-subscription/", admin_grant_subscription),
    # Bulk question import (must precede the router's collection-questions/<pk>/)
    path("collection-questions/import/", ImportCollectionQuestionsView.as_view()),
    path("homework-questions/import/", ImportHomeworkQuestionsView.as_view()),
    # Exams
    path("exams/simulator/", StartSimulatorView.as_view()),
    path("exams/simulator/options/", simulator_options),
    path("exams/teacher/", StartTeacherTestView.as_view()),
    path(
        "teacher-tests/question-bank/",
        TeacherTestViewSet.as_view({"get": "question_bank"}),
    ),
    path("teacher-tests/", TeacherTestViewSet.as_view({"get": "list", "post": "create"})),
    path(
        "teacher-tests/<int:pk>/",
        TeacherTestViewSet.as_view({"delete": "destroy"}),
    ),
    path("exams/<int:exam_id>/", ExamDetailView.as_view()),
    path("exams/<int:exam_id>/answer/", AnswerView.as_view()),
    path("exams/<int:exam_id>/finish/", FinishView.as_view()),
    path("exams/<int:exam_id>/review/", ExamReviewView.as_view()),
    path("results/", MyResultsView.as_view()),
    path("my-homework/", StudentHomeworkView.as_view()),
    # Billing
    path("subscription/", my_subscription),
    path("subscription/checkout/", checkout),
    # Teacher scheduling helpers
    path("teacher/assignments/", teacher_assignments),
    # Analytics
    path("teacher/students/<int:student_id>/analytics/", teacher_student_analytics),
    # Routers
    path("", include(router.urls)),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api_patterns)),
]
