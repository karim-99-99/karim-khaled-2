from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied

from core.permissions import IsTeacherOrAdmin
from groups.models import GroupStudent, GroupTeacher
from .models import Session
from .serializers import SessionSerializer


class SessionViewSet(viewsets.ModelViewSet):
    queryset = Session.objects.select_related("subject", "group").all()
    serializer_class = SessionSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        return [IsTeacherOrAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_admin_role:
            return qs
        if user.is_teacher:
            # A teacher manages/sees the sessions they run, plus any in the
            # groups+subjects they are assigned to.
            links = GroupTeacher.objects.filter(teacher=user)
            group_ids = list(links.values_list("group_id", flat=True))
            from django.db.models import Q

            qs = qs.filter(Q(teacher=user) | Q(group_id__in=group_ids)).distinct()
        else:
            # Student: only sessions for the groups they belong to.
            group_ids = list(
                GroupStudent.objects.filter(student=user).values_list(
                    "group_id", flat=True
                )
            )
            qs = qs.filter(group_id__in=group_ids)
        return qs

    def _validate_scope(self, serializer):
        """A teacher may only schedule for a group+subject they are assigned to."""
        user = self.request.user
        if user.is_admin_role:
            return
        group = serializer.validated_data.get("group")
        subject = serializer.validated_data.get("subject")
        if not group or not subject:
            raise PermissionDenied("لا بد من اختيار المجموعة والمادة")
        if not GroupTeacher.objects.filter(
            teacher=user, group=group, subject=subject
        ).exists():
            raise PermissionDenied("لا تُدرّس هذه المادة في هذه المجموعة")

    def perform_create(self, serializer):
        user = self.request.user
        self._validate_scope(serializer)
        if user.is_teacher:
            serializer.save(teacher=user, teacher_name=user.full_name)
        else:
            serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        self._validate_scope(serializer)
        if user.is_teacher:
            serializer.save(teacher=user, teacher_name=user.full_name)
        else:
            serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.is_teacher and instance.teacher_id != user.id:
            raise PermissionDenied("يمكنك حذف حصصك أنت فقط")
        instance.delete()
