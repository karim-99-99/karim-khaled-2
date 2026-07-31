import re

from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import WhatsAppAuthSession
from .serializers import UserSerializer
from .social import (
    complete_whatsapp_session,
    issue_tokens,
    parse_whatsapp_webhook,
    start_whatsapp_session,
    upsert_telegram_user,
    verify_telegram_login,
    whatsapp_deeplink,
)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def auth_providers(request):
    """Which social login methods are configured."""
    tg_user = (settings.TELEGRAM_BOT_USERNAME or "").strip().lstrip("@")
    tg_token = (settings.TELEGRAM_BOT_TOKEN or "").strip()
    return Response(
        {
            "telegram": {
                "enabled": bool(tg_user and tg_token),
                "bot_username": tg_user,
            },
            # WhatsApp login hidden for now (kept in backend for later).
            "whatsapp": {"enabled": False},
            "email": {"enabled": True},
        }
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def telegram_auth(request):
    """
    Complete Telegram Login Widget auth.
    Body: id, first_name, last_name?, username?, photo_url?, auth_date, hash
    """
    try:
        payload = verify_telegram_login(request.data)
    except ValueError as exc:
        code = str(exc)
        messages = {
            "TELEGRAM_NOT_CONFIGURED": "تسجيل تيليجرام غير مفعّل على السيرفر",
            "MISSING_HASH": "بيانات تيليجرام غير مكتملة",
            "INVALID_HASH": "فشل التحقق من بيانات تيليجرام",
            "AUTH_EXPIRED": "انتهت صلاحية تسجيل تيليجرام، حاول مرة أخرى",
        }
        return Response(
            {"detail": messages.get(code, "تعذّر تسجيل الدخول عبر تيليجرام")},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = upsert_telegram_user(payload)
    if not user.is_active:
        return Response(
            {"detail": "تم إيقاف حسابك، برجاء التواصل مع الإدارة."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return Response(issue_tokens(user))


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def whatsapp_start(request):
    """Start WhatsApp deep-link login; frontend opens wa_url and polls status."""
    try:
        session = start_whatsapp_session()
    except ValueError:
        return Response(
            {
                "detail": "تسجيل واتساب غير مفعّل. أضف WHATSAPP_BUSINESS_NUMBER في إعدادات السيرفر."
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response(
        {
            "token": session.token,
            "wa_url": whatsapp_deeplink(session),
            "expires_at": session.expires_at,
            "hint": "افتح واتساب وأرسل الرسالة الجاهزة، ثم ارجع للموقع تلقائياً.",
        }
    )


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def whatsapp_status(request, token):
    session = WhatsAppAuthSession.objects.filter(token=token).first()
    if not session:
        return Response({"detail": "جلسة غير موجودة"}, status=status.HTTP_404_NOT_FOUND)

    if session.status != WhatsAppAuthSession.Status.COMPLETED and session.is_expired:
        session.status = WhatsAppAuthSession.Status.EXPIRED
        session.save(update_fields=["status"])
        return Response({"status": "expired", "detail": "انتهت صلاحية الجلسة"})

    if session.status == WhatsAppAuthSession.Status.COMPLETED:
        user_data = UserSerializer(session.user).data if session.user_id else None
        return Response(
            {
                "status": "completed",
                "access": session.access_token,
                "refresh": session.refresh_token,
                "user": user_data,
            }
        )

    return Response({"status": "pending"})


@csrf_exempt
@api_view(["GET", "POST"])
@permission_classes([permissions.AllowAny])
def whatsapp_webhook(request):
    """
    Meta WhatsApp Cloud API webhook.
    GET: verification challenge
    POST: inbound messages containing VERIFY <token>
    """
    if request.method == "GET":
        mode = request.GET.get("hub.mode")
        verify_token = request.GET.get("hub.verify_token")
        challenge = request.GET.get("hub.challenge")
        if (
            mode == "subscribe"
            and verify_token
            and verify_token == (settings.WHATSAPP_VERIFY_TOKEN or "")
        ):
            return HttpResponse(challenge or "", content_type="text/plain")
        return HttpResponse("Forbidden", status=403)

    events = parse_whatsapp_webhook(request.data if isinstance(request.data, dict) else {})
    for event in events:
        text = event.get("text") or ""
        match = re.search(r"VERIFY\s+(\S+)", text, flags=re.IGNORECASE)
        if not match:
            continue
        token = match.group(1).strip()
        session = WhatsAppAuthSession.objects.filter(token=token).first()
        if not session or session.status == WhatsAppAuthSession.Status.COMPLETED:
            continue
        if session.is_expired:
            session.status = WhatsAppAuthSession.Status.EXPIRED
            session.save(update_fields=["status"])
            continue
        complete_whatsapp_session(
            session, phone=event.get("phone") or "", full_name=event.get("name") or ""
        )

    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def whatsapp_dev_complete(request):
    """
    Local/dev helper when WhatsApp Cloud webhook is not available yet.
    Body: { token, phone, full_name }
    Disabled unless DJANGO_DEBUG=True.
    """
    if not settings.DEBUG:
        return Response({"detail": "Not available"}, status=status.HTTP_404_NOT_FOUND)
    token = (request.data.get("token") or "").strip()
    phone = (request.data.get("phone") or "").strip()
    full_name = (request.data.get("full_name") or "").strip()
    session = WhatsAppAuthSession.objects.filter(token=token).first()
    if not session:
        return Response({"detail": "جلسة غير موجودة"}, status=status.HTTP_404_NOT_FOUND)
    if session.is_expired:
        return Response({"detail": "انتهت صلاحية الجلسة"}, status=status.HTTP_400_BAD_REQUEST)
    complete_whatsapp_session(session, phone=phone, full_name=full_name or "طالب واتساب")
    return Response(
        {
            "status": "completed",
            "access": session.access_token,
            "refresh": session.refresh_token,
            "user": UserSerializer(session.user).data,
        }
    )
