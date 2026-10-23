"""BigBlueButton API client. Shared secret stays on the server."""

from __future__ import annotations

import hashlib
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from django.conf import settings


class BBBError(Exception):
    def __init__(self, message, *, key=""):
        super().__init__(message)
        self.key = key


def configured():
    return bool((getattr(settings, "BBB_URL", "") or "").strip()) and bool(
        (getattr(settings, "BBB_SECRET", "") or "").strip()
    )


def meeting_id_for(session_id: int) -> str:
    return f"zad-session-{session_id}"


def _checksum(call: str, query: str) -> str:
    secret = settings.BBB_SECRET
    algo = (getattr(settings, "BBB_CHECKSUM", "sha1") or "sha1").lower()
    raw = f"{call}{query}{secret}".encode()
    if algo == "sha256":
        return hashlib.sha256(raw).hexdigest()
    return hashlib.sha1(raw).hexdigest()


def _passwords(meeting_id: str) -> tuple[str, str]:
    digest = hashlib.sha256(
        f"{settings.SECRET_KEY}:{meeting_id}:bbb".encode()
    ).hexdigest()
    return digest[:16], digest[16:32]


def api_call(call: str, params: dict) -> ET.Element:
    if not configured():
        raise BBBError("خدمة اللايف غير مفعّلة على السيرفر")
    base = settings.BBB_URL.rstrip("/")
    query = urllib.parse.urlencode(
        [(k, v) for k, v in params.items() if v is not None and v != ""]
    )
    checksum = _checksum(call, query)
    url = f"{base}/api/{call}?{query}&checksum={checksum}"
    req = urllib.request.Request(url, headers={"Accept": "application/xml"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read()
    except Exception as exc:
        raise BBBError("تعذّر الاتصال بخادم اللايف") from exc
    try:
        root = ET.fromstring(body)
    except ET.ParseError as exc:
        raise BBBError("رد غير مفهوم من خادم اللايف") from exc
    code = (root.findtext("returncode") or "").upper()
    if code != "SUCCESS":
        message = root.findtext("message") or "فشل طلب اللايف"
        key = root.findtext("messageKey") or ""
        raise BBBError(message, key=key)
    return root


def ensure_meeting(session) -> str:
    """Create (or reuse) the meeting for a timetable row. Returns meetingID."""
    meeting_id = session.bbb_meeting_id or meeting_id_for(session.id)
    mod_pw, att_pw = _passwords(meeting_id)
    name = (session.display_title or "حصة")[:200]
    if session.group_id and getattr(session.group, "name", ""):
        name = f"{name} — {session.group.name}"[:200]
    api_call(
        "create",
        {
            "name": name,
            "meetingID": meeting_id,
            "attendeePW": att_pw,
            "moderatorPW": mod_pw,
            "record": "true",
            "autoStartRecording": "true",
            "allowStartStopRecording": "true",
            "duration": int(session.duration_minutes or 60),
            "welcome": "أهلاً بكم في الحصة المباشرة",
            "meta_sessionId": str(session.id),
            "meta_groupId": str(session.group_id or ""),
        },
    )
    if session.bbb_meeting_id != meeting_id:
        session.bbb_meeting_id = meeting_id
        session.save(update_fields=["bbb_meeting_id"])
    return meeting_id


def join_url(session, *, full_name: str, user_id, moderator: bool) -> str:
    meeting_id = ensure_meeting(session)
    mod_pw, att_pw = _passwords(meeting_id)
    root = api_call(
        "join",
        {
            "meetingID": meeting_id,
            "fullName": (full_name or "مشارك")[:250],
            "role": "MODERATOR" if moderator else "VIEWER",
            "password": mod_pw if moderator else att_pw,
            "userID": str(user_id),
            "redirect": "false",
        },
    )
    url = root.findtext("url") or ""
    if not url:
        raise BBBError("الخادم لم يرجع رابط الدخول")
    return url
