from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import (
    LoginView,
    MeView,
    RegisterView,
    admin_accounts,
    available_students,
    set_user_active,
    set_user_role,
    teacher_list,
)
from assessments.views import (
    AnswerView,
    CollectionQuestionViewSet,
    ExamDetailView,
    ExamReviewView,
    FinishView,
    HomeworkQuestionViewSet,
    MyResultsView,
    StartSimulatorView,
    StartTeacherTestView,
    StudentHomeworkView,
)
from billing.views import (
    AdminPaymentViewSet,
    AdminSubscriptionViewSet,
    admin_grant_subscription,
    checkout,
    my_subscription,
)
from catalog.views import LessonViewSet, SubjectViewSet
from core.views import (
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
    # Public / video
    path("home/free-content/", home_free_content),
    path("home/next-session/", next_session),
    path("videos/<str:bunny_id>/token/", video_token),
    # Admin user management
    path("admin/accounts/", admin_accounts),
    path("admin/available-students/", available_students),
    path("admin/teachers/", teacher_list),
    path("admin/users/<int:user_id>/set-active/", set_user_active),
    path("admin/users/<int:user_id>/set-role/", set_user_role),
    path("admin/users/<int:user_id>/grant-subscription/", admin_grant_subscription),
    # Exams
    path("exams/simulator/", StartSimulatorView.as_view()),
    path("exams/teacher/", StartTeacherTestView.as_view()),
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
