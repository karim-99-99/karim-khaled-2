"""Class rating API helpers (Task 30)."""

from __future__ import annotations

from django.utils import timezone

from core.time_rules import to_riyadh
from groups.models import GroupStudent, GroupTeacher
from scheduling.models import (
    ClassRating,
    Session,
    SessionAttendance,
    StudentClassRating,
)

TAGS = list(StudentClassRating.TAG_CHOICES)
DURATION_WARN_MIN = 15


def _teacher_owns(session, user) -> bool:
    if user.is_admin_role:
        return True
    if session.teacher_id == user.id:
        return True
    return GroupTeacher.objects.filter(
        teacher=user, group_id=session.group_id, subject_id=session.subject_id
    ).exists()


def _fmt_time(dt):
    local = to_riyadh(dt)
    if local is None:
        return ""
    h, m = local.hour, local.minute
    suffix = "ص" if h < 12 else "م"
    h12 = h % 12 or 12
    return f"{h12}:{m:02d} {suffix}"


def _duration_label(mins: int) -> str:
    mins = int(mins or 0)
    if mins <= 0:
        return "—"
    if mins < 60:
        return f"{mins} دقائق"
    h = mins // 60
    rem = mins % 60
    if rem == 0:
        if h == 1:
            return "ساعة"
        if h == 2:
            return "ساعتان"
        return f"{h} ساعات"
    return f"{h}:{rem:02d} ساعة"


def build_rate_payload(session, user):
    rating, _ = ClassRating.objects.get_or_create(session=session)
    links = (
        GroupStudent.objects.filter(group_id=session.group_id)
        .select_related("student")
        .order_by("student__full_name", "student_id")
    )
    att_map = {
        a.student_id: a
        for a in SessionAttendance.objects.filter(session=session)
    }
    row_map = {
        r.student_id: r for r in rating.student_rows.select_related("student")
    }
    students = []
    present = absent = 0
    star_sum = 0
    star_n = 0
    for link in links:
        stu = link.student
        att = att_map.get(stu.id)
        status = att.status if att else SessionAttendance.Status.ABSENT
        if status == SessionAttendance.Status.PRESENT:
            present += 1
        else:
            absent += 1
        row = row_map.get(stu.id)
        stars = row.stars if row else 0
        if status == SessionAttendance.Status.PRESENT and stars:
            star_sum += stars
            star_n += 1
        duration = att.duration_min if att else 0
        joined = att.joined_at if att else None
        if joined:
            join_line = f"دخل {_fmt_time(joined)} · مدة الحضور {_duration_label(duration)}"
        else:
            join_line = "لم يدخل الحصة"
        from accounts.models import ParentTelegramLink

        has_parent = ParentTelegramLink.objects.filter(
            student=stu, is_active=True
        ).exists()
        students.append(
            {
                "student_id": stu.id,
                "full_name": stu.full_name,
                "initial": (stu.full_name or "?")[:1],
                "attendance_status": status,
                "status_source": att.status_source if att else None,
                "joined_at": joined.isoformat() if joined else None,
                "duration_min": duration,
                "join_line": join_line,
                "short_warn": bool(
                    status == SessionAttendance.Status.PRESENT
                    and 0 < duration < DURATION_WARN_MIN
                ),
                "stars": stars,
                "tags": row.tags if row else [],
                "note": row.note if row else "",
                "has_parent": has_parent,
            }
        )

    local = to_riyadh(session.start_time)
    end_local = to_riyadh(session.end_time)
    day_names = (
        "الاثنين",
        "الثلاثاء",
        "الأربعاء",
        "الخميس",
        "الجمعة",
        "السبت",
        "الأحد",
    )
    months = (
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
    meta = ""
    if local:
        meta = (
            f"{session.group.name if session.group_id else ''} · "
            f"{day_names[local.weekday()]} {local.day} {months[local.month]} · "
            f"{_fmt_time(session.start_time)} – {_fmt_time(session.end_time)}"
        )

    avg = round(star_sum / star_n, 1) if star_n else 0
    return {
        "session": {
            "id": session.id,
            "title": session.display_title,
            "group_id": session.group_id,
            "group_name": session.group.name if session.group_id else "",
            "subject_id": session.subject_id,
            "subject_name": session.subject.name if session.subject_id else "",
            "subject_theme_key": getattr(session.subject, "theme_key", "")
            if session.subject_id
            else "",
            "start_time": session.start_time.isoformat(),
            "end_time": session.end_time.isoformat(),
            "meta": meta,
            "is_rated": bool(session.rated_at),
        },
        "rating": {
            "id": rating.id,
            "status": rating.status,
            "general_note": rating.general_note,
            "saved_at": rating.saved_at.isoformat() if rating.saved_at else None,
            "reports_sent_at": (
                rating.reports_sent_at.isoformat()
                if rating.reports_sent_at
                else None
            ),
        },
        "stats": {
            "present": present,
            "absent": absent,
            "avg_stars": avg,
            "total": len(students),
        },
        "students": students,
        "tag_options": TAGS,
        "can_edit": _teacher_owns(session, user),
    }


def save_rate_payload(session, user, data, *, as_draft: bool):
    if not _teacher_owns(session, user):
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("ليست من حصصك")

    rating, _ = ClassRating.objects.get_or_create(session=session)
    rating.general_note = (data.get("general_note") or "")[:2000]
    rating.updated_by = user

    records = data.get("students") or []
    roster_ids = set(
        GroupStudent.objects.filter(group_id=session.group_id).values_list(
            "student_id", flat=True
        )
    )

    for rec in records:
        sid = int(rec.get("student_id"))
        if sid not in roster_ids:
            continue
        status = rec.get("attendance_status")
        if status in (
            SessionAttendance.Status.PRESENT,
            SessionAttendance.Status.ABSENT,
        ):
            att, _ = SessionAttendance.objects.get_or_create(
                session=session,
                student_id=sid,
                defaults={
                    "status": status,
                    "status_source": SessionAttendance.StatusSource.TEACHER,
                    "marked_by": user,
                },
            )
            if att.status != status:
                att.status = status
                att.status_source = SessionAttendance.StatusSource.TEACHER
                att.marked_by = user
                att.save(
                    update_fields=["status", "status_source", "marked_by", "marked_at"]
                )

        stars = int(rec.get("stars") or 0)
        if status == SessionAttendance.Status.ABSENT:
            stars = 0
        stars = max(0, min(5, stars))
        tags = [t for t in (rec.get("tags") or []) if t in TAGS]
        note = (rec.get("note") or "")[:1000]
        StudentClassRating.objects.update_or_create(
            class_rating=rating,
            student_id=sid,
            defaults={"stars": stars, "tags": tags, "note": note},
        )

    if as_draft:
        rating.status = ClassRating.Status.DRAFT
        rating.save()
        # draft keeps needs-rating
        if session.rated_at:
            session.rated_at = None
            session.save(update_fields=["rated_at"])
        return build_rate_payload(session, user), {"draft": True}

    rating.status = ClassRating.Status.SAVED
    rating.saved_at = timezone.now()
    rating.save()
    session.rated_at = rating.saved_at
    session.save(update_fields=["rated_at"])

    from accounts.parent_telegram import deliver_class_reports

    force = bool(data.get("resend_reports"))
    # Background-ish: deliver after response when not forcing immediate resend counts.
    # Keep sync delivery so the UI can show sent/no_parent/failed counts.
    delivery = deliver_class_reports(
        session, class_rating=rating, created_by=user, force=force
    )
    payload = build_rate_payload(session, user)
    payload["delivery"] = delivery
    return payload, delivery
