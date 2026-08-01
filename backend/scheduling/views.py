from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied

from core.permissions import IsAdmin, IsTeacherOrAdmin
from groups.models import GroupStudent, GroupTeacher
from .models import Session
from .serializers import SessionSerializer


class SessionViewSet(viewsets.ModelViewSet):
    """
    Admin owns the timetable (create / edit schedule / delete).
    Teachers may only update zoom_link (and status) on their sessions.
    """

    queryset = Session.objects.select_related("subject", "group", "teacher").all()
    serializer_class = SessionSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        if self.action in ("create", "destroy"):
            return [IsAdmin()]
        # update / partial_update: admin full edit, teacher Zoom-only
        return [IsTeacherOrAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_admin_role:
            return qs
        if user.is_teacher:
            links = GroupTeacher.objects.filter(teacher=user)
            group_ids = list(links.values_list("group_id", flat=True))
            from django.db.models import Q

            qs = qs.filter(Q(teacher=user) | Q(group_id__in=group_ids)).distinct()
        else:
            group_ids = list(
                GroupStudent.objects.filter(student=user).values_list(
                    "group_id", flat=True
                )
            )
            qs = qs.filter(group_id__in=group_ids)
        return qs

    def _resolve_teacher(self, group, subject, explicit_teacher=None):
        if explicit_teacher is not None:
            return explicit_teacher, explicit_teacher.full_name
        if group and subject:
            link = (
                GroupTeacher.objects.filter(group=group, subject=subject)
                .select_related("teacher")
                .first()
            )
            if link:
                return link.teacher, link.teacher.full_name
        return None, ""

    def perform_create(self, serializer):
        if not self.request.user.is_admin_role:
            raise PermissionDenied("المدير فقط يضع جدول الحصص")
        group = serializer.validated_data.get("group")
        subject = serializer.validated_data.get("subject")
        if not group or not subject:
            raise PermissionDenied("لا بد من اختيار المجموعة والمادة")
        teacher, teacher_name = self._resolve_teacher(
            group, subject, serializer.validated_data.get("teacher")
        )
        serializer.save(teacher=teacher, teacher_name=teacher_name)

    def perform_update(self, serializer):
        user = self.request.user
        instance = self.get_object()

        if user.is_admin_role:
            group = serializer.validated_data.get("group", instance.group)
            subject = serializer.validated_data.get("subject", instance.subject)
            if "teacher" in serializer.validated_data:
                teacher = serializer.validated_data["teacher"]
                teacher_name = teacher.full_name if teacher else ""
            else:
                teacher, teacher_name = self._resolve_teacher(group, subject, None)
                if teacher is None:
                    teacher, teacher_name = instance.teacher, instance.teacher_name
            serializer.save(teacher=teacher, teacher_name=teacher_name or "")
            return

        # Teacher: Zoom (+ optional status) only on sessions they teach / are assigned to.
        owns = instance.teacher_id == user.id
        assigned = False
        if instance.group_id and instance.subject_id:
            assigned = GroupTeacher.objects.filter(
                teacher=user, group_id=instance.group_id, subject_id=instance.subject_id
            ).exists()
        if not owns and not assigned:
            raise PermissionDenied("يمكنك تعديل رابط Zoom لحصصك فقط")

        zoom = serializer.validated_data.get("zoom_link", instance.zoom_link)
        status = serializer.validated_data.get("status", instance.status)
        instance.zoom_link = zoom or ""
        instance.status = status
        instance.save(update_fields=["zoom_link", "status"])

    def perform_destroy(self, instance):
        if not self.request.user.is_admin_role:
            raise PermissionDenied("المدير فقط يحذف الحصص من الجدول")
        instance.delete()
