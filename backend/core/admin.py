from django.contrib import admin

from catalog.models import Lesson, Subject
from groups.models import GroupStudent, GroupTeacher, StudyGroup
from assessments.models import CollectionQuestion, Exam, HomeworkQuestion
from scheduling.models import Session
from billing.models import Payment, Subscription
from .models import AdminAuditLog, VideoView

for model in [
    Subject,
    Lesson,
    StudyGroup,
    GroupStudent,
    GroupTeacher,
    HomeworkQuestion,
    CollectionQuestion,
    Exam,
    Session,
    Subscription,
    Payment,
    VideoView,
    AdminAuditLog,
]:
    admin.site.register(model)
