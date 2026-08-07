from django.db import transaction
from django.db.models import Count, Prefetch
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.access import assert_teacher_can_manage_subject
from core.permissions import IsAdminOrReadOnly
from .models import Lesson, LessonSection, Subject
from .serializers import (
    LessonListSerializer,
    LessonSectionSerializer,
    LessonSerializer,
    SubjectSerializer,
    annotate_lesson_list,
)


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
        qs = annotate_lesson_list(
            Lesson.objects.filter(subject_id=pk, is_archived=False).select_related(
                "subject"
            )
        ).order_by("order_number", "id")
        return Response(
            LessonListSerializer(qs, many=True, context={"request": request}).data
        )


class LessonViewSet(viewsets.ModelViewSet):
    serializer_class = LessonSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "sections"):
            return [permissions.IsAuthenticated()]
        from core.permissions import IsTeacherOrAdmin

        return [IsTeacherOrAdmin()]

    def get_serializer_class(self):
        if self.action == "list":
            return LessonListSerializer
        return LessonSerializer

    def get_queryset(self):
        qs = annotate_lesson_list(
            Lesson.objects.filter(is_archived=False).select_related("subject")
        ).order_by("order_number", "id")
        if self.action == "retrieve":
            qs = qs.prefetch_related(
                Prefetch(
                    "sections",
                    queryset=LessonSection.objects.order_by("order_number", "id"),
                )
            )
        subject = self.request.query_params.get("subject")
        if subject:
            qs = qs.filter(subject_id=subject)
        return qs

    def retrieve(self, request, *args, **kwargs):
        lesson = self.get_object()
        data = self.get_serializer(lesson).data
        if data.get("is_locked"):
            sections = []
            for s in data.get("sections") or []:
                sections.append({**s, "bunny_video_id": "", "pdf_url": ""})
            data = {
                **data,
                "bunny_video_id": "",
                "pdf_url": "",
                "sections": sections,
                "detail": "هذا الدرس يتطلب تفعيل الحساب من الإدارة أو الاشتراك.",
            }
        return Response(data)

    @action(detail=False, methods=["post"])
    def reorder(self, request):
        """Atomically set lesson order: { subject, ordered_ids: [id, ...] }."""
        subject_id = request.data.get("subject")
        ordered_ids = request.data.get("ordered_ids") or []
        if not subject_id or not isinstance(ordered_ids, list) or not ordered_ids:
            return Response(
                {"detail": "أرسل subject و ordered_ids"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        assert_teacher_can_manage_subject(request.user, subject_id)
        ids = [int(x) for x in ordered_ids]
        found = set(
            Lesson.objects.filter(
                subject_id=subject_id, is_archived=False, id__in=ids
            ).values_list("id", flat=True)
        )
        if len(found) != len(ids):
            return Response(
                {"detail": "بعض الدروس غير موجودة في هذه المادة"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            for i, lid in enumerate(ids):
                Lesson.objects.filter(id=lid).update(order_number=10000 + i)
            for i, lid in enumerate(ids):
                Lesson.objects.filter(id=lid).update(order_number=i + 1)
        rows = annotate_lesson_list(
            Lesson.objects.filter(subject_id=subject_id, is_archived=False).select_related(
                "subject"
            )
        ).order_by("order_number", "id")
        return Response(
            LessonListSerializer(rows, many=True, context={"request": request}).data
        )

    @action(detail=True, methods=["get", "post"])
    def sections(self, request, pk=None):
        lesson = self.get_object()
        if request.method == "GET":
            qs = lesson.sections.all().order_by("order_number", "id")
            data = LessonSectionSerializer(qs, many=True, context={"request": request}).data
            if lesson_locked_for(request.user, lesson):
                data = [{**s, "bunny_video_id": "", "pdf_url": ""} for s in data]
            return Response(data)

        assert_teacher_can_manage_subject(request.user, lesson.subject_id)
        ser = LessonSectionSerializer(data={**request.data, "lesson": lesson.id})
        ser.is_valid(raise_exception=True)
        order = ser.validated_data.get("order_number") or (lesson.sections.count() + 1)
        section = LessonSection.objects.create(
            lesson=lesson,
            title=ser.validated_data["title"],
            order_number=order,
            bunny_video_id=ser.validated_data.get("bunny_video_id", ""),
            pdf_url=ser.validated_data.get("pdf_url", ""),
        )
        return Response(
            LessonSectionSerializer(section, context={"request": request}).data,
            status=201,
        )

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
        assert_teacher_can_manage_subject(user, serializer.instance.subject_id)
        assert_teacher_can_manage_subject(user, subject_id)
        serializer.save()

    def perform_destroy(self, instance):
        assert_teacher_can_manage_subject(self.request.user, instance.subject_id)
        instance.delete()


def lesson_locked_for(user, lesson):
    from core.access import lesson_is_free_preview, user_has_full_content_access

    if user_has_full_content_access(user):
        return False
    return not lesson_is_free_preview(lesson)


class LessonSectionViewSet(viewsets.ModelViewSet):
    serializer_class = LessonSectionSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        from core.permissions import IsTeacherOrAdmin

        return [IsTeacherOrAdmin()]

    def get_queryset(self):
        qs = LessonSection.objects.select_related("lesson", "lesson__subject").order_by(
            "order_number", "id"
        )
        lesson = self.request.query_params.get("lesson")
        if lesson:
            qs = qs.filter(lesson_id=lesson)
        return qs

    def retrieve(self, request, *args, **kwargs):
        section = self.get_object()
        data = self.get_serializer(section).data
        if data.get("is_locked"):
            data = {
                **data,
                "bunny_video_id": "",
                "pdf_url": "",
                "detail": "هذه الحصة تتطلب تفعيل الحساب من الإدارة أو الاشتراك.",
            }
        return Response(data)

    @action(detail=False, methods=["post"])
    def reorder(self, request):
        """Atomically set section order: { lesson, ordered_ids: [id, ...] }."""
        lesson_id = request.data.get("lesson")
        ordered_ids = request.data.get("ordered_ids") or []
        if not lesson_id or not isinstance(ordered_ids, list) or not ordered_ids:
            return Response(
                {"detail": "أرسل lesson و ordered_ids"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        lesson = Lesson.objects.filter(id=lesson_id).first()
        if not lesson:
            return Response({"detail": "الدرس غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        assert_teacher_can_manage_subject(request.user, lesson.subject_id)
        ids = [int(x) for x in ordered_ids]
        found = set(
            LessonSection.objects.filter(lesson_id=lesson_id, id__in=ids).values_list(
                "id", flat=True
            )
        )
        if len(found) != len(ids):
            return Response(
                {"detail": "بعض العناوين الفرعية غير موجودة في هذا الدرس"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            for i, sid in enumerate(ids):
                LessonSection.objects.filter(id=sid).update(order_number=10000 + i)
            for i, sid in enumerate(ids):
                LessonSection.objects.filter(id=sid).update(order_number=i + 1)
        rows = LessonSection.objects.filter(lesson_id=lesson_id).order_by(
            "order_number", "id"
        )
        return Response(
            LessonSectionSerializer(rows, many=True, context={"request": request}).data
        )

    def perform_create(self, serializer):
        lesson = serializer.validated_data["lesson"]
        assert_teacher_can_manage_subject(self.request.user, lesson.subject_id)
        if not serializer.validated_data.get("order_number"):
            serializer.save(order_number=lesson.sections.count() + 1)
        else:
            serializer.save()

    def perform_update(self, serializer):
        lesson = serializer.instance.lesson
        assert_teacher_can_manage_subject(self.request.user, lesson.subject_id)
        serializer.save()

    def perform_destroy(self, instance):
        assert_teacher_can_manage_subject(self.request.user, instance.lesson.subject_id)
        instance.delete()
