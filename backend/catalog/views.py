from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from core.access import assert_teacher_can_manage_subject
from core.permissions import IsAdminOrReadOnly
from .models import Lesson, Subject
from .serializers import LessonSerializer, SubjectSerializer


def _subject_id_from(value):
    if value is None:
        return None
    return value.pk if hasattr(value, "pk") else int(value)


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAdminOrReadOnly]

    @action(detail=True, methods=["get"])
    def lessons(self, request, pk=None):
        # Free-tier users see every lesson title, but locked ones are flagged.
        qs = Lesson.objects.filter(subject_id=pk, is_archived=False).select_related(
            "subject"
        )
        return Response(
            LessonSerializer(qs, many=True, context={"request": request}).data
        )


class LessonViewSet(viewsets.ModelViewSet):
    serializer_class = LessonSerializer

    def get_permissions(self):
        # Authenticated students (even without activation) can browse lessons.
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        from core.permissions import IsTeacherOrAdmin

        return [IsTeacherOrAdmin()]

    def get_queryset(self):
        qs = Lesson.objects.filter(is_archived=False).select_related("subject")
        subject = self.request.query_params.get("subject")
        if subject:
            qs = qs.filter(subject_id=subject)
        return qs

    def retrieve(self, request, *args, **kwargs):
        lesson = self.get_object()
        data = self.get_serializer(lesson).data
        # Hide video/pdf for locked lessons (free-tier / not yet activated).
        if data.get("is_locked"):
            data = {
                **data,
                "bunny_video_id": "",
                "pdf_url": "",
                "detail": "هذا الدرس يتطلب تفعيل الحساب من الإدارة أو الاشتراك.",
            }
        return Response(data)

    def perform_create(self, serializer):
        user = self.request.user
        subject_id = _subject_id_from(serializer.validated_data.get("subject"))
        assert_teacher_can_manage_subject(user, subject_id)
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user
        subject_id = _subject_id_from(
            serializer.validated_data.get("subject", serializer.instance.subject_id)
        )
        # Must be allowed on current subject and on any new subject.
        assert_teacher_can_manage_subject(user, serializer.instance.subject_id)
        assert_teacher_can_manage_subject(user, subject_id)
        serializer.save()

    def perform_destroy(self, instance):
        assert_teacher_can_manage_subject(self.request.user, instance.subject_id)
        instance.delete()
