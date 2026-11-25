"""Parent Telegram bot linking + report delivery (Task 33)."""

from __future__ import annotations

import hashlib
import logging
import os
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

TAGS_AR = ("متفاعل", "ملتزم بالواجب", "يحتاج متابعة", "شارك بالإجابة")


def bot_token() -> str:
    return (
        getattr(settings, "TELEGRAM_BOT_TOKEN", "")
        or os.environ.get("TELEGRAM_BOT_TOKEN", "")
        or ""
    ).strip()


def bot_username() -> str:
    return (
        getattr(settings, "TELEGRAM_BOT_USERNAME", "")
        or os.environ.get("TELEGRAM_BOT_USERNAME", "")
        or ""
    ).strip().lstrip("@")


def ensure_parent_link_code(student) -> str:
    if getattr(student, "parent_link_code", None):
        return student.parent_link_code
    code = secrets.token_urlsafe(9)[:12]
    # avoid collisions
    from accounts.models import User

    while User.objects.filter(parent_link_code=code).exists():
        code = secrets.token_urlsafe(9)[:12]
    student.parent_link_code = code
    student.save(update_fields=["parent_link_code"])
    return code


def parent_link_url(student) -> str:
    code = ensure_parent_link_code(student)
    uname = bot_username()
    if not uname:
        return f"/start {code}"
    return f"https://t.me/{uname}?start={code}"


def send_telegram_message(chat_id: str, text: str) -> bool:
    token = bot_token()
    if not token or not chat_id:
        return False
    try:
        import urllib.request
        import json

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        body = json.dumps(
            {"chat_id": chat_id, "text": text, "disable_web_page_preview": True}
        ).encode("utf-8")
        req = urllib.request.Request(
            url, data=body, headers={"Content-Type": "application/json"}, method="POST"
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            return 200 <= resp.status < 300
    except Exception as exc:
        logger.warning("telegram send failed chat=%s: %s", chat_id, exc)
        return False


def handle_bot_update(update: dict) -> dict:
    """Process Telegram webhook update — /start {code}."""
    from accounts.models import ParentTelegramLink, User

    message = update.get("message") or update.get("edited_message") or {}
    text = (message.get("text") or "").strip()
    chat = message.get("chat") or {}
    chat_id = str(chat.get("id") or "")
    if not chat_id or not text.startswith("/start"):
        return {"ok": True, "handled": False}

    parts = text.split(maxsplit=1)
    code = (parts[1] if len(parts) > 1 else "").strip()
    if not code:
        send_telegram_message(
            chat_id,
            "أرسل رابط الربط من حساب الطالب على مرام لربط ولي الأمر.",
        )
        return {"ok": True, "handled": True}

    student = User.objects.filter(
        parent_link_code=code, role=User.Role.STUDENT
    ).first()
    if not student:
        send_telegram_message(chat_id, "كود الربط غير صحيح أو منتهي.")
        return {"ok": True, "handled": True, "error": "bad_code"}

    from_user = message.get("from") or {}
    link, _ = ParentTelegramLink.objects.update_or_create(
        student=student,
        chat_id=chat_id,
        defaults={
            "telegram_username": from_user.get("username") or "",
            "display_name": " ".join(
                filter(
                    None,
                    [from_user.get("first_name"), from_user.get("last_name")],
                )
            ),
            "is_active": True,
        },
    )
    send_telegram_message(
        chat_id, f"تم ربطك بحساب {student.full_name} ✅"
    )
    return {"ok": True, "handled": True, "link_id": link.id}


def _stars_line(n: int) -> str:
    n = max(0, min(5, int(n or 0)))
    return "★" * n + "☆" * (5 - n)


def build_class_report_text(*, student, session, attendance, row, general_note: str) -> str:
    subject = session.subject.name if session.subject_id else ""
    title = session.display_title
    present = (attendance or {}).get("status") == "present"
    duration = (attendance or {}).get("duration_min") or 0
    if not present:
        note = (row or {}).get("note") or ""
        lines = [f"غاب {student.full_name} عن حصة {title} اليوم"]
        if note:
            lines.append(f"ملحوظة المدرس: {note}")
        if general_note:
            lines.append(f"ملحوظة عامة: {general_note}")
        return "\n".join(lines)

    tags = (row or {}).get("tags") or []
    stars = (row or {}).get("stars") or 0
    note = (row or {}).get("note") or ""
    lines = [
        f"تقرير حصة — {student.full_name}",
        f"المادة: {subject}",
        f"الحصة: {title}",
        f"الحضور: حاضر · مدة {duration} د",
        f"التقييم: {_stars_line(stars)}",
    ]
    if tags:
        lines.append("الصفات: " + " · ".join(tags))
    if note:
        lines.append(f"ملحوظة المدرس: {note}")
    if general_note:
        lines.append(f"ملحوظة عامة على الحصة: {general_note}")
    return "\n".join(lines)


def deliver_class_reports(session, *, class_rating, created_by=None, force=False):
    """Send/store parent reports after saving a class rating."""
    from accounts.models import ParentReport, ParentTelegramLink
    from groups.models import GroupStudent
    from scheduling.models import SessionAttendance

    if class_rating.reports_sent_at and not force:
        return {"sent": 0, "skipped": True, "reason": "already_sent"}

    students = list(
        GroupStudent.objects.filter(group_id=session.group_id).select_related(
            "student"
        )
    )
    att_map = {
        a.student_id: a
        for a in SessionAttendance.objects.filter(session=session)
    }
    row_map = {r.student_id: r for r in class_rating.student_rows.all()}
    sent = 0
    no_parent = 0
    failed = 0

    for link in students:
        student = link.student
        att = att_map.get(student.id)
        row = row_map.get(student.id)
        att_payload = {
            "status": att.status if att else "absent",
            "duration_min": att.duration_min if att else 0,
            "joined_at": att.joined_at.isoformat() if att and att.joined_at else None,
        }
        row_payload = {
            "stars": row.stars if row else 0,
            "tags": row.tags if row else [],
            "note": row.note if row else "",
        }
        text = build_class_report_text(
            student=student,
            session=session,
            attendance=att_payload,
            row=row_payload,
            general_note=class_rating.general_note or "",
        )
        parents = list(
            ParentTelegramLink.objects.filter(student=student, is_active=True)
        )
        report = ParentReport.objects.create(
            student=student,
            subject_id=session.subject_id,
            session=session,
            report_type=ParentReport.ReportType.CLASS,
            payload={
                "attendance": att_payload,
                "rating": row_payload,
                "general_note": class_rating.general_note,
            },
            content_text=text,
            recipients=[{"chat_id": p.chat_id} for p in parents],
            created_by=created_by,
        )
        if not parents:
            report.status = ParentReport.Status.NO_PARENT
            report.sent_at = timezone.now()
            report.save(update_fields=["status", "sent_at"])
            no_parent += 1
            continue

        ok_any = False
        for p in parents:
            for _attempt in range(3):
                if send_telegram_message(p.chat_id, text):
                    ok_any = True
                    break
        report.status = (
            ParentReport.Status.SENT if ok_any else ParentReport.Status.FAILED
        )
        report.sent_at = timezone.now()
        report.save(update_fields=["status", "sent_at"])
        if ok_any:
            sent += 1
        else:
            failed += 1

    class_rating.reports_sent_at = timezone.now()
    class_rating.save(update_fields=["reports_sent_at"])
    return {
        "sent": sent,
        "no_parent": no_parent,
        "failed": failed,
        "skipped": False,
    }


def send_task_reminder(*, teacher, student, subject, task_titles: list[str]):
    """One reminder per student+subject per 24h."""
    from accounts.models import ParentReport, ParentTelegramLink

    since = timezone.now() - timedelta(hours=24)
    recent = ParentReport.objects.filter(
        student=student,
        subject=subject,
        report_type=ParentReport.ReportType.REMINDER,
        created_at__gte=since,
    ).exists()
    if recent:
        return {"ok": False, "reason": "cooldown", "detail": "اتبعت ✓ خلال آخر 24 ساعة"}

    titles = task_titles or ["مهام متأخرة"]
    text = (
        f"{student.full_name} عنده {len(titles)} مهام متأخرة في {subject.name}:\n"
        + "\n".join(f"• {t}" for t in titles[:12])
    )
    parents = list(
        ParentTelegramLink.objects.filter(student=student, is_active=True)
    )
    report = ParentReport.objects.create(
        student=student,
        subject=subject,
        report_type=ParentReport.ReportType.REMINDER,
        payload={"tasks": titles},
        content_text=text,
        recipients=[{"chat_id": p.chat_id} for p in parents],
        created_by=teacher,
    )
    if not parents:
        report.status = ParentReport.Status.NO_PARENT
        report.sent_at = timezone.now()
        report.save(update_fields=["status", "sent_at"])
        return {"ok": True, "status": "no_parent", "report_id": report.id}

    ok_any = False
    for p in parents:
        for _ in range(3):
            if send_telegram_message(p.chat_id, text):
                ok_any = True
                break
    report.status = ParentReport.Status.SENT if ok_any else ParentReport.Status.FAILED
    report.sent_at = timezone.now()
    report.save(update_fields=["status", "sent_at"])
    return {
        "ok": ok_any,
        "status": report.status,
        "report_id": report.id,
        "detail": "تم إرسال التذكير" if ok_any else "تعذّر الإرسال",
    }
