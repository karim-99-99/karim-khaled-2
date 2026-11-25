"""Teacher Tasks board — lesson ↔ collection linking (Task 17 / B10)."""

from __future__ import annotations

from django.db import models, transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Lesson
from core.access import (
    assert_teacher_can_edit_content,
    teacher_can_edit_content,
    teacher_can_manage_subject,
)
from core.permissions import IsTeacherOrAdmin
from core.time_rules import session_ended, to_riyadh
from groups.models import GroupTeacher, StudyGroup
from scheduling.models import Session

from .models import (
    CollectionQuestion,
    CollectionSubLesson,
    HomeworkSubLesson,
    LessonCollectionLink,
)

_AR_WEEKDAYS = (
    "الاثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
    "الأحد",
)
_AR_MONTHS = (
    "",
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
)


def _fmt_ar_session(dt):
    local = to_riyadh(dt)
    if local is None:
        return ""
    # Python weekday: Mon=0 … Sun=6 → Arabic list above
    wd = _AR_WEEKDAYS[local.weekday()]
    return f"{wd} {local.day} {_AR_MONTHS[local.month]}"


def _fmt_ar_time(dt):
    local = to_riyadh(dt)
    if local is None:
        return ""
    return f"{local.hour % 12 or 12}:{local.minute:02d} {'م' if local.hour >= 12 else 'ص'}"


def _subject_groups(subject_id):
    gids = (
        GroupTeacher.objects.filter(subject_id=subject_id)
        .values_list("group_id", flat=True)
        .distinct()
    )
    return list(StudyGroup.objects.filter(id__in=gids).order_by("name"))


def _links_for_scope(*, lesson_id=None, extra_session_id=None, group_id=None):
    """
    Effective links for a scope.
    When group_id set: use group overrides if any exist for that target; else default.
    """
    base = LessonCollectionLink.objects.select_related(
        "collection_lesson", "collection_sub_lesson", "group"
    )
    if extra_session_id:
        qs = base.filter(extra_session_id=extra_session_id)
    else:
        qs = base.filter(lesson_id=lesson_id, extra_session__isnull=True)

    if group_id is None:
        return qs.filter(group__isnull=True).order_by("order_number", "id")

    override = qs.filter(group_id=group_id)
    if override.exists():
        return override.order_by("order_number", "id")
    return qs.filter(group__isnull=True).order_by("order_number", "id")


def _has_group_override(lesson_id=None, extra_session_id=None, group_id=None):
    qs = LessonCollectionLink.objects.all()
    if extra_session_id:
        qs = qs.filter(extra_session_id=extra_session_id)
    else:
        qs = qs.filter(lesson_id=lesson_id, extra_session__isnull=True)
    if group_id:
        return qs.filter(group_id=group_id).exists()
    return qs.filter(group__isnull=False).exists()


def _question_count_for_node(collection_lesson_id, sub_lesson_id=None):
    qs = CollectionQuestion.objects.filter(
        lesson_id=collection_lesson_id, needs_review=False
    )
    if sub_lesson_id:
        qs = qs.filter(sub_lesson_id=sub_lesson_id)
    return qs.count()


def _serialize_link(link):
    sub = link.collection_sub_lesson
    main = link.collection_lesson
    qcount = _question_count_for_node(main.id, sub.id if sub else None)
    if sub:
        title = f"{main.title} › {sub.title}"
        kind = "sub"
        meta = f"فرعي · {qcount} سؤال"
    else:
        subs_n = main.collection_sub_lessons.count()
        title = main.title
        kind = "main"
        meta = f"رئيسي · {subs_n} عنوان · {qcount} سؤال"
    return {
        "id": link.id,
        "order_number": link.order_number,
        "collection_lesson_id": main.id,
        "collection_sub_lesson_id": sub.id if sub else None,
        "title": title,
        "kind": kind,
        "question_count": qcount,
        "meta": meta,
        "is_whole_main": sub is None,
        "group_id": link.group_id,
    }


def _foundation_session_for_group(group_id, subject_id, lesson):
    """Match session by lesson FK, else by chronological order_number among foundation."""
    qs = Session.objects.filter(
        group_id=group_id,
        subject_id=subject_id,
        session_type=Session.SessionType.FOUNDATION,
    ).order_by("start_time")
    by_fk = qs.filter(lesson_id=lesson.id).first()
    if by_fk:
        return by_fk
    rows = list(qs)
    idx = max(0, (lesson.order_number or 1) - 1)
    if idx < len(rows):
        return rows[idx]
    return None


def _release_status(*, lesson, subject_id, groups, group_id, has_tasks, now):
    if not has_tasks:
        return {
            "tone": "r",
            "code": "empty",
            "label": "لا توجد مهام مربوطة",
        }

    if group_id:
        sess = _foundation_session_for_group(group_id, subject_id, lesson)
        gname = next((g.name for g in groups if g.id == group_id), "المجموعة")
        if sess is None:
            return {
                "tone": "gr",
                "code": "no_session",
                "label": "لا حصة مجدولة لهذه المجموعة",
            }
        if session_ended(sess, now):
            return {
                "tone": "g",
                "code": "released",
                "label": f"ظهرت لـ {gname}",
            }
        return {
            "tone": "gr",
            "code": "upcoming",
            "label": f"تظهر بعد حصة {_fmt_ar_session(sess.start_time)}",
            "session_start": sess.start_time.isoformat(),
        }

    # Default scope — across all subject groups
    released = []
    upcoming = []
    for g in groups:
        sess = _foundation_session_for_group(g.id, subject_id, lesson)
        if sess is None:
            continue
        if session_ended(sess, now):
            released.append(g.name)
        else:
            upcoming.append((g.name, sess))

    if released and not upcoming:
        return {"tone": "g", "code": "released_all", "label": "ظهرت لكل المجموعات"}
    if released and upcoming:
        soon = upcoming[0][1]
        left = " · ".join(released)
        right = " · ".join(n for n, _ in upcoming)
        return {
            "tone": "o",
            "code": "released_partial",
            "label": f"ظهرت لـ {left} — {right} بعد {_fmt_ar_time(soon.end_time)} اليوم"
            if soon.end_time.date() == to_riyadh(now).date()
            else f"ظهرت لـ {left} — {right} بعد حصة {_fmt_ar_session(soon.start_time)}",
        }
    if upcoming:
        sess = upcoming[0][1]
        return {
            "tone": "gr",
            "code": "upcoming",
            "label": f"تظهر بعد حصة {_fmt_ar_session(sess.start_time)}",
        }
    return {"tone": "gr", "code": "no_session", "label": "لا حصص مجدولة بعد"}


def _assert_can_view(user, subject_id):
    if getattr(user, "is_admin_role", False):
        return
    if not teacher_can_manage_subject(user, subject_id):
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("ليست لديك صلاحية على هذه المادة")


class TeacherTasksBoardView(APIView):
    """
    GET ?subject=&group=  → board (lessons + extras + stats + tree meta)
    """

    permission_classes = [IsTeacherOrAdmin]

    def get(self, request):
        subject_id = request.query_params.get("subject")
        if not subject_id or not str(subject_id).isdigit():
            return Response(
                {"detail": "أرسل subject"}, status=status.HTTP_400_BAD_REQUEST
            )
        subject_id = int(subject_id)
        _assert_can_view(request.user, subject_id)

        group_param = request.query_params.get("group")
        group_id = int(group_param) if group_param and str(group_param).isdigit() else None

        can_edit = teacher_can_edit_content(request.user, subject_id)
        groups = _subject_groups(subject_id)
        group_ids_with_override = set(
            LessonCollectionLink.objects.filter(
                group_id__isnull=False,
                lesson__subject_id=subject_id,
            ).values_list("group_id", flat=True)
        ) | set(
            LessonCollectionLink.objects.filter(
                group_id__isnull=False,
                extra_session__subject_id=subject_id,
            ).values_list("group_id", flat=True)
        )

        lessons = list(
            Lesson.objects.filter(subject_id=subject_id, is_archived=False).order_by(
                "order_number", "id"
            )
        )
        hw_counts = {
            row["lesson_id"]: row["c"]
            for row in HomeworkSubLesson.objects.filter(lesson__subject_id=subject_id)
            .values("lesson_id")
            .annotate(c=Count("id"))
        }
        hw_q_counts = {
            row["lesson_id"]: row["c"]
            for row in HomeworkSubLesson.objects.filter(lesson__subject_id=subject_id)
            .annotate(
                c=Count("questions", filter=Q(questions__needs_review=False))
            )
            .values("lesson_id", "c")
        }

        now = timezone.now()
        rows = []
        linked_lessons = 0
        linked_tasks = 0

        for lesson in lessons:
            links = list(
                _links_for_scope(lesson_id=lesson.id, group_id=group_id)
            )
            hw_n = hw_counts.get(lesson.id, 0)
            col_n = len(links)
            has_tasks = hw_n > 0 or col_n > 0
            if has_tasks:
                linked_lessons += 1
            linked_tasks += hw_n + col_n

            is_override = bool(group_id) and _has_group_override(
                lesson_id=lesson.id, group_id=group_id
            )
            any_override_groups = list(
                LessonCollectionLink.objects.filter(
                    lesson_id=lesson.id, group__isnull=False
                )
                .values_list("group__name", flat=True)
                .distinct()
            )

            status_info = _release_status(
                lesson=lesson,
                subject_id=subject_id,
                groups=groups,
                group_id=group_id,
                has_tasks=has_tasks,
                now=now,
            )

            homework = list(
                HomeworkSubLesson.objects.filter(lesson_id=lesson.id)
                .annotate(
                    _qc=Count("questions", filter=Q(questions__needs_review=False))
                )
                .order_by("order_number", "id")
            )

            rows.append(
                {
                    "kind": "lesson",
                    "id": lesson.id,
                    "order_number": lesson.order_number,
                    "title": lesson.title,
                    "homework_count": hw_n,
                    "collection_count": col_n,
                    "homework_question_total": hw_q_counts.get(lesson.id, 0)
                    or sum(h._qc for h in homework),
                    "collection_question_total": sum(
                        _question_count_for_node(
                            L.collection_lesson_id, L.collection_sub_lesson_id
                        )
                        for L in links
                    ),
                    "release": status_info,
                    "is_override": is_override,
                    "override_group_names": any_override_groups,
                    "homework": [
                        {
                            "id": h.id,
                            "title": h.title,
                            "question_count": h._qc,
                            "locked": True,
                        }
                        for h in homework
                    ],
                    "collections": [_serialize_link(L) for L in links],
                }
            )

        # Extra sessions when a group is selected
        extras = []
        if group_id:
            for sess in (
                Session.objects.filter(
                    group_id=group_id,
                    subject_id=subject_id,
                    session_type=Session.SessionType.EXTRA,
                )
                .order_by("start_time")
            ):
                links = list(
                    _links_for_scope(extra_session_id=sess.id, group_id=group_id)
                )
                # Extras always store group-scoped links (or default with extra_session)
                if not links:
                    links = list(
                        _links_for_scope(extra_session_id=sess.id, group_id=None)
                    )
                col_n = len(links)
                has_tasks = col_n > 0
                if has_tasks:
                    linked_tasks += col_n
                extras.append(
                    {
                        "kind": "extra",
                        "id": sess.id,
                        "order_number": None,
                        "title": sess.display_title,
                        "homework_count": 0,
                        "collection_count": col_n,
                        "homework_question_total": 0,
                        "collection_question_total": sum(
                            _question_count_for_node(
                                L.collection_lesson_id, L.collection_sub_lesson_id
                            )
                            for L in links
                        ),
                        "release": {
                            "tone": "b" if not has_tasks else "g",
                            "code": "extra",
                            "label": "حصة إضافية · المجموعة بس"
                            if not has_tasks
                            else "حصة إضافية",
                        },
                        "is_override": False,
                        "override_group_names": [],
                        "homework": [],
                        "collections": [_serialize_link(L) for L in links],
                        "session_start": sess.start_time.isoformat(),
                        "session_label": f"{_fmt_ar_session(sess.start_time)} {_fmt_ar_time(sess.start_time)}",
                    }
                )

        override_count = len(group_ids_with_override)

        return Response(
            {
                "subject_id": subject_id,
                "can_edit": can_edit,
                "group_id": group_id,
                "stats": {
                    "linked_lessons": linked_lessons,
                    "total_lessons": len(lessons),
                    "linked_tasks": linked_tasks,
                    "group_overrides": override_count,
                },
                "groups": [
                    {
                        "id": g.id,
                        "name": g.name,
                        "has_override": g.id in group_ids_with_override,
                    }
                    for g in groups
                ],
                "lessons": rows,
                "extras": extras,
            }
        )


class TeacherTasksCollectionTreeView(APIView):
    """GET ?subject= → collection tree for the add panel."""

    permission_classes = [IsTeacherOrAdmin]

    def get(self, request):
        subject_id = request.query_params.get("subject")
        if not subject_id or not str(subject_id).isdigit():
            return Response(
                {"detail": "أرسل subject"}, status=status.HTTP_400_BAD_REQUEST
            )
        subject_id = int(subject_id)
        _assert_can_view(request.user, subject_id)

        lessons = Lesson.objects.filter(
            subject_id=subject_id, is_archived=False
        ).order_by("order_number", "id")
        tree = []
        for lesson in lessons:
            subs = list(
                CollectionSubLesson.objects.filter(lesson_id=lesson.id)
                .annotate(
                    _qc=Count(
                        "questions", filter=Q(questions__needs_review=False)
                    )
                )
                .order_by("order_number", "id")
            )
            main_q = CollectionQuestion.objects.filter(
                lesson_id=lesson.id, needs_review=False
            ).count()
            tree.append(
                {
                    "id": lesson.id,
                    "title": lesson.title,
                    "question_count": main_q,
                    "sub_count": len(subs),
                    "subs": [
                        {
                            "id": s.id,
                            "title": s.title,
                            "question_count": s._qc,
                        }
                        for s in subs
                    ],
                }
            )
        return Response({"subject_id": subject_id, "tree": tree})


class TeacherTasksLinksView(APIView):
    """
    POST add links / reorder / reset-default
    DELETE remove one link
    """

    permission_classes = [IsTeacherOrAdmin]

    def post(self, request):
        action = request.data.get("action") or "add"
        if action == "add":
            return self._add(request)
        if action == "reorder":
            return self._reorder(request)
        if action == "reset_default":
            return self._reset_default(request)
        return Response({"detail": "action غير معروف"}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request):
        link_id = request.data.get("id") or request.query_params.get("id")
        if not link_id:
            return Response({"detail": "أرسل id"}, status=status.HTTP_400_BAD_REQUEST)
        link = (
            LessonCollectionLink.objects.select_related(
                "lesson", "extra_session", "collection_lesson"
            )
            .filter(id=link_id)
            .first()
        )
        if not link:
            return Response({"detail": "غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        subject_id = (
            link.lesson.subject_id
            if link.lesson_id
            else link.extra_session.subject_id
        )
        assert_teacher_can_edit_content(request.user, subject_id)
        link.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _target_subject(self, lesson_id, extra_session_id):
        if extra_session_id:
            sess = Session.objects.filter(id=extra_session_id).first()
            if not sess:
                return None, Response(
                    {"detail": "الحصة غير موجودة"}, status=status.HTTP_404_NOT_FOUND
                )
            return sess.subject_id, sess
        lesson = Lesson.objects.filter(id=lesson_id).first()
        if not lesson:
            return None, Response(
                {"detail": "الدرس غير موجود"}, status=status.HTTP_404_NOT_FOUND
            )
        return lesson.subject_id, lesson

    def _add(self, request):
        lesson_id = request.data.get("lesson")
        extra_session_id = request.data.get("extra_session")
        group_id = request.data.get("group")
        nodes = request.data.get("nodes") or []
        if not nodes or (not lesson_id and not extra_session_id):
            return Response(
                {"detail": "أرسل lesson أو extra_session و nodes"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if lesson_id and extra_session_id:
            return Response(
                {"detail": "أرسل lesson أو extra_session فقط"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subject_id, _target = self._target_subject(lesson_id, extra_session_id)
        if subject_id is None:
            return _target  # Response
        assert_teacher_can_edit_content(request.user, subject_id)

        # When editing a group scope on a lesson that still uses default,
        # first copy default → group rows so edits don't mutate default.
        if group_id and lesson_id:
            existing_override = LessonCollectionLink.objects.filter(
                lesson_id=lesson_id, group_id=group_id
            ).exists()
            if not existing_override:
                defaults = list(
                    LessonCollectionLink.objects.filter(
                        lesson_id=lesson_id, group__isnull=True
                    )
                )
                for d in defaults:
                    LessonCollectionLink.objects.create(
                        lesson_id=lesson_id,
                        collection_lesson_id=d.collection_lesson_id,
                        collection_sub_lesson_id=d.collection_sub_lesson_id,
                        group_id=group_id,
                        order_number=d.order_number,
                    )

        # Scope queryset for duplicate checks
        scope = LessonCollectionLink.objects.filter(group_id=group_id or None)
        if extra_session_id:
            scope = scope.filter(extra_session_id=extra_session_id)
        else:
            scope = scope.filter(lesson_id=lesson_id, extra_session__isnull=True)
            if group_id:
                scope = LessonCollectionLink.objects.filter(
                    lesson_id=lesson_id, group_id=group_id
                )
            else:
                scope = LessonCollectionLink.objects.filter(
                    lesson_id=lesson_id, group__isnull=True
                )

        created = []
        errors = []
        next_order = (scope.aggregate(m=models.Max("order_number"))["m"] or 0) + 1

        with transaction.atomic():
            for node in nodes:
                main_id = node.get("collection_lesson")
                sub_id = node.get("collection_sub_lesson")
                if not main_id:
                    errors.append("collection_lesson مطلوب")
                    continue
                main = Lesson.objects.filter(id=main_id, subject_id=subject_id).first()
                if not main:
                    errors.append(f"تجميعة {main_id} غير موجودة")
                    continue
                sub = None
                if sub_id:
                    sub = CollectionSubLesson.objects.filter(
                        id=sub_id, lesson_id=main.id
                    ).first()
                    if not sub:
                        errors.append(f"فرعي {sub_id} غير موجود تحت الرئيسي")
                        continue

                # Duplicate / containment rules
                if sub is None:
                    # Linking whole main — block if any of its subs already linked
                    if scope.filter(collection_lesson_id=main.id).exists():
                        errors.append(
                            f"«{main.title}» مربوط بالفعل (رئيسي أو فرعي منه) — امنع التكرار"
                        )
                        continue
                else:
                    if scope.filter(
                        collection_lesson_id=main.id, collection_sub_lesson__isnull=True
                    ).exists():
                        errors.append(
                            f"«{main.title}» مربوط كرئيسي كامل — الفرعي متضمن بالفعل"
                        )
                        continue
                    if scope.filter(collection_sub_lesson_id=sub.id).exists():
                        errors.append(f"«{sub.title}» مربوط بالدرس بالفعل")
                        continue

                link = LessonCollectionLink.objects.create(
                    lesson_id=lesson_id if not extra_session_id else None,
                    extra_session_id=extra_session_id or None,
                    collection_lesson=main,
                    collection_sub_lesson=sub,
                    group_id=group_id or None,
                    order_number=next_order,
                )
                next_order += 1
                created.append(_serialize_link(link))

        return Response(
            {"created": created, "errors": errors},
            status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST,
        )

    def _reorder(self, request):
        lesson_id = request.data.get("lesson")
        extra_session_id = request.data.get("extra_session")
        group_id = request.data.get("group")
        ordered_ids = request.data.get("ordered_ids") or []
        subject_id, err = self._target_subject(lesson_id, extra_session_id)
        if subject_id is None:
            return err
        assert_teacher_can_edit_content(request.user, subject_id)
        if not isinstance(ordered_ids, list) or not ordered_ids:
            return Response(
                {"detail": "أرسل ordered_ids"}, status=status.HTTP_400_BAD_REQUEST
            )

        if group_id and lesson_id:
            if not LessonCollectionLink.objects.filter(
                lesson_id=lesson_id, group_id=group_id
            ).exists():
                # Copy default then reorder on override
                for d in LessonCollectionLink.objects.filter(
                    lesson_id=lesson_id, group__isnull=True
                ):
                    LessonCollectionLink.objects.create(
                        lesson_id=lesson_id,
                        collection_lesson_id=d.collection_lesson_id,
                        collection_sub_lesson_id=d.collection_sub_lesson_id,
                        group_id=group_id,
                        order_number=d.order_number,
                    )

        qs = LessonCollectionLink.objects.filter(group_id=group_id or None)
        if extra_session_id:
            qs = qs.filter(extra_session_id=extra_session_id)
        else:
            qs = qs.filter(lesson_id=lesson_id)
            if group_id:
                qs = LessonCollectionLink.objects.filter(
                    lesson_id=lesson_id, group_id=group_id
                )
            else:
                qs = LessonCollectionLink.objects.filter(
                    lesson_id=lesson_id, group__isnull=True
                )

        with transaction.atomic():
            for i, lid in enumerate(ordered_ids):
                qs.filter(id=lid).update(order_number=i + 1)
        return Response(
            {"collections": [_serialize_link(L) for L in qs.order_by("order_number", "id")]}
        )

    def _reset_default(self, request):
        lesson_id = request.data.get("lesson")
        group_id = request.data.get("group")
        if not lesson_id or not group_id:
            return Response(
                {"detail": "أرسل lesson و group"}, status=status.HTTP_400_BAD_REQUEST
            )
        lesson = Lesson.objects.filter(id=lesson_id).first()
        if not lesson:
            return Response({"detail": "الدرس غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        assert_teacher_can_edit_content(request.user, lesson.subject_id)
        deleted, _ = LessonCollectionLink.objects.filter(
            lesson_id=lesson_id, group_id=group_id
        ).delete()
        return Response({"deleted": deleted})
