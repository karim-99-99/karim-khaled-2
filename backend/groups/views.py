from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import User
from core.permissions import IsAdmin, IsTeacherOrAdmin
from .models import GroupStudent, GroupTeacher, StudyGroup
from .serializers import (
    GroupStudentSerializer,
    GroupTeacherSerializer,
    StudyGroupSerializer,
)


class AdminGroupViewSet(viewsets.ModelViewSet):
    """Admin-only group management."""

    queryset = StudyGroup.objects.all().prefetch_related(
        "student_links__student", "teacher_links__teacher", "teacher_links__subject"
    )
    serializer_class = StudyGroupSerializer
    permission_classes = [IsAdmin]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get", "post"])
    def students(self, request, pk=None):
        group = self.get_object()
        if request.method == "POST":
            student_id = request.data.get("student_id")
            student = get_object_or_404(User, id=student_id, role=User.Role.STUDENT)
            link, created = GroupStudent.objects.get_or_create(
                group=group, student=student
            )
            if not created:
                return Response(
                    {"detail": "الطالب موجود بالفعل في هذه المجموعة"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(GroupStudentSerializer(link).data, status=201)
        links = group.student_links.select_related("student")
        return Response(GroupStudentSerializer(links, many=True).data)

    @action(detail=True, methods=["delete"], url_path="students/(?P<student_id>[^/.]+)")
    def remove_student(self, request, pk=None, student_id=None):
        group = self.get_object()
        GroupStudent.objects.filter(group=group, student_id=student_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"])
    def teachers(self, request, pk=None):
        group = self.get_object()
        if request.method == "POST":
            teacher_id = request.data.get("teacher_id")
            subject_id = request.data.get("subject")
            teacher = get_object_or_404(User, id=teacher_id, role=User.Role.TEACHER)
            link, created = GroupTeacher.objects.get_or_create(
                group=group, teacher=teacher, subject_id=subject_id
            )
            # Keep the teacher's default subject in sync so they can author
            # lessons/questions without picking a group.
            if subject_id and not teacher.taught_subject_id:
                teacher.taught_subject_id = subject_id
                teacher.save(update_fields=["taught_subject"])
            return Response(GroupTeacherSerializer(link).data, status=201)
        links = group.teacher_links.select_related("teacher", "subject")
        return Response(GroupTeacherSerializer(links, many=True).data)

    @action(detail=True, methods=["delete"], url_path="teachers/(?P<link_id>[^/.]+)")
    def remove_teacher(self, request, pk=None, link_id=None):
        GroupTeacher.objects.filter(group_id=pk, id=link_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeacherGroupViewSet(viewsets.ReadOnlyModelViewSet):
    """Teacher sees ONLY groups they are assigned to (scoped server-side)."""

    serializer_class = StudyGroupSerializer
    permission_classes = [IsTeacherOrAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin_role:
            return StudyGroup.objects.all().prefetch_related("student_links__student")
        group_ids = GroupTeacher.objects.filter(teacher=user).values_list(
            "group_id", flat=True
        )
        return StudyGroup.objects.filter(id__in=group_ids).prefetch_related(
            "student_links__student"
        )

    @action(detail=True, methods=["get"])
    def students(self, request, pk=None):
        group = self.get_object()
        links = group.student_links.select_related("student")
        status_filter = request.query_params.get("status")
        data = GroupStudentSerializer(links, many=True).data
        if status_filter in ("active", "expired"):
            data = [d for d in data if d["subscription_status"] == status_filter]
        return Response(data)
