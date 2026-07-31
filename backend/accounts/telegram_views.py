from django.conf import settings
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .telegram_oidc import (
    exchange_telegram_code,
    issue_tokens,
    start_telegram_oauth,
    telegram_configured,
    upsert_telegram_user_from_claims,
)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def telegram_status(request):
    return Response(
        {
            "enabled": telegram_configured(),
            "client_id": bool((settings.TELEGRAM_CLIENT_ID or settings.TELEGRAM_BOT_TOKEN)),
        }
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def telegram_start(request):
    """
    Hadafak-style: return Telegram OAuth URL for a popup window.
    Body: { redirect_uri: "https://frontend/auth/telegram/callback" }
    """
    redirect_uri = (request.data.get("redirect_uri") or "").strip()
    if not redirect_uri:
        return Response(
            {"success": False, "error": "redirect_uri مطلوب"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        data = start_telegram_oauth(redirect_uri)
    except ValueError as exc:
        code = str(exc)
        messages = {
            "TELEGRAM_NOT_CONFIGURED": "تسجيل تيليجرام غير مفعّل على السيرفر",
            "INVALID_REDIRECT_URI": "رابط العودة غير مسموح",
        }
        return Response(
            {"success": False, "error": messages.get(code, code)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(data)


@api_view(["POST", "GET"])
@permission_classes([permissions.AllowAny])
def telegram_complete(request):
    """
    Exchange OIDC code+state for app JWT (same role as hadafak /auth/telegram/callback).
    """
    data = request.data if request.method == "POST" else request.GET
    code = (data.get("code") or "").strip()
    state = (data.get("state") or "").strip()
    if not code or not state:
        return Response(
            {"detail": "بيانات تيليجرام غير مكتملة"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        claims = exchange_telegram_code(code=code, state=state)
        user = upsert_telegram_user_from_claims(claims)
    except ValueError as exc:
        return Response(
            {"detail": f"فشل التحقق من تيليجرام ({exc})"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception:
        return Response(
            {"detail": "فشل تسجيل تيليجرام"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not user.is_active:
        return Response(
            {"detail": "تم إيقاف حسابك، برجاء التواصل مع الإدارة."},
            status=status.HTTP_403_FORBIDDEN,
        )

    tokens = issue_tokens(user)
    # hadafak-compatible key + our keys
    return Response(
        {
            "access_token": tokens["access"],
            "access": tokens["access"],
            "refresh": tokens["refresh"],
            "user": tokens["user"],
        }
    )
