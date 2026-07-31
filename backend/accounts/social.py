"""Telegram Login Widget + WhatsApp deep-link auth helpers."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from datetime import timedelta
from typing import Any
from urllib.parse import quote

from django.conf import settings
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, WhatsAppAuthSession
from .phone import normalize_phone
from .serializers import UserSerializer


def issue_tokens(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user).data,
    }


_TELEGRAM_AUTH_FIELDS = (
    "id",
    "first_name",
    "last_name",
    "username",
    "photo_url",
    "auth_date",
)


def _telegram_scalar(value: Any) -> str:
    if isinstance(value, (list, tuple)):
        value = value[0] if value else ""
    if value is None:
        return ""
    return str(value)


def verify_telegram_login(data: dict[str, Any]) -> dict[str, Any]:
    """
    Validate Telegram Login Widget / OAuth redirect payload.
    https://core.telegram.org/widgets/login#checking-authorization
    """
    bot_token = (settings.TELEGRAM_BOT_TOKEN or "").strip()
    if not bot_token:
        raise ValueError("TELEGRAM_NOT_CONFIGURED")

    received_hash = _telegram_scalar(data.get("hash"))
    if not received_hash:
        raise ValueError("MISSING_HASH")

    # Only hash the official fields — extra query keys break verification.
    check_dict = {}
    for key in _TELEGRAM_AUTH_FIELDS:
        raw = data.get(key)
        value = _telegram_scalar(raw)
        if value != "":
            check_dict[key] = value

    if "id" not in check_dict or "auth_date" not in check_dict:
        raise ValueError("MISSING_HASH")

    data_check_string = "\n".join(
        f"{k}={check_dict[k]}" for k in sorted(check_dict.keys())
    )
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    expected = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, received_hash):
        raise ValueError("INVALID_HASH")

    auth_date = int(check_dict.get("auth_date") or 0)
    if auth_date and time.time() - auth_date > 86400:
        raise ValueError("AUTH_EXPIRED")

    return check_dict


def upsert_telegram_user(payload: dict[str, Any]) -> User:
    tg_id = str(payload["id"])
    first = (payload.get("first_name") or "").strip()
    last = (payload.get("last_name") or "").strip()
    full_name = f"{first} {last}".strip() or payload.get("username") or f"Telegram {tg_id}"
    username = (payload.get("username") or "").strip()

    user = User.objects.filter(telegram_id=tg_id).first()
    if user:
        changed = []
        if full_name and user.full_name != full_name:
            user.full_name = full_name
            changed.append("full_name")
        if username and user.telegram_username != username:
            user.telegram_username = username
            changed.append("telegram_username")
        if user.contact_channel != User.ContactChannel.TELEGRAM:
            user.contact_channel = User.ContactChannel.TELEGRAM
            changed.append("contact_channel")
        if changed:
            user.save(update_fields=changed)
        return user

    email = f"tg_{tg_id}@telegram.oauth.local"
    user = User(
        email=email,
        full_name=full_name,
        phone=None,
        telegram_id=tg_id,
        telegram_username=username,
        contact_channel=User.ContactChannel.TELEGRAM,
        role=User.Role.STUDENT,
        is_active=True,
    )
    user.set_unusable_password()
    user.save()
    return user


def whatsapp_configured() -> bool:
    return bool(
        (settings.WHATSAPP_BUSINESS_NUMBER or "").strip()
        and (
            (settings.WHATSAPP_VERIFY_TOKEN or "").strip()
            or (settings.WHATSAPP_ACCESS_TOKEN or "").strip()
        )
    )


def start_whatsapp_session() -> WhatsAppAuthSession:
    if not (settings.WHATSAPP_BUSINESS_NUMBER or "").strip():
        raise ValueError("WHATSAPP_NOT_CONFIGURED")

    token = secrets.token_urlsafe(24)
    session = WhatsAppAuthSession.objects.create(
        token=token,
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    return session


def whatsapp_deeplink(session: WhatsAppAuthSession) -> str:
    number = "".join(
        c for c in (settings.WHATSAPP_BUSINESS_NUMBER or "") if c.isdigit()
    )
    # User sends this exact code; webhook matches it.
    text = f"VERIFY {session.token}"
    return f"https://wa.me/{number}?text={quote(text)}"


def complete_whatsapp_session(
    session: WhatsAppAuthSession, *, phone: str, full_name: str
) -> User:
    normalized = normalize_phone(phone) or "".join(c for c in phone if c.isdigit())
    name = (full_name or "").strip() or f"WhatsApp {normalized[-4:]}"

    user = User.objects.filter(phone=normalized).first()
    if not user and normalized:
        # try without leading 0 / with country variants
        from .phone import phones_match_query

        for candidate in phones_match_query(normalized):
            user = User.objects.filter(phone=candidate).first()
            if user:
                break

    if user:
        user.contact_channel = User.ContactChannel.WHATSAPP
        if name and (not user.full_name or user.full_name.startswith("WhatsApp")):
            user.full_name = name
        user.save()
    else:
        email = f"wa_{normalized}@whatsapp.oauth.local"
        user = User(
            email=email,
            full_name=name,
            phone=normalized or None,
            contact_channel=User.ContactChannel.WHATSAPP,
            role=User.Role.STUDENT,
            is_active=True,
        )
        user.set_unusable_password()
        user.save()

    tokens = issue_tokens(user)
    session.status = WhatsAppAuthSession.Status.COMPLETED
    session.phone = user.phone or normalized
    session.full_name = user.full_name
    session.user = user
    session.access_token = tokens["access"]
    session.refresh_token = tokens["refresh"]
    session.save()
    return user


def parse_whatsapp_webhook(body: dict) -> list[dict]:
    """Extract inbound message events: {phone, name, text}."""
    events = []
    for entry in body.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            contacts = {
                c.get("wa_id"): (c.get("profile") or {}).get("name", "")
                for c in (value.get("contacts") or [])
            }
            for msg in value.get("messages") or []:
                if msg.get("type") != "text":
                    continue
                phone = msg.get("from") or ""
                text = ((msg.get("text") or {}).get("body") or "").strip()
                events.append(
                    {
                        "phone": phone,
                        "name": contacts.get(phone, ""),
                        "text": text,
                    }
                )
    return events
