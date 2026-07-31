"""Telegram OIDC login helpers (popup flow like hadafak-ehab)."""

from __future__ import annotations

import base64
import hashlib
import json
import secrets
from datetime import timedelta
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import jwt
from django.conf import settings
from django.utils import timezone
from jwt import PyJWKClient
from rest_framework_simplejwt.tokens import RefreshToken

from .models import TelegramOAuthState, User
from .phone import normalize_phone
from .serializers import UserSerializer

TELEGRAM_AUTH = "https://oauth.telegram.org/auth"
TELEGRAM_TOKEN = "https://oauth.telegram.org/token"
TELEGRAM_JWKS = "https://oauth.telegram.org/.well-known/jwks.json"


def telegram_client_id() -> str:
    cid = (settings.TELEGRAM_CLIENT_ID or "").strip()
    if cid:
        return cid
    token = (settings.TELEGRAM_BOT_TOKEN or "").strip()
    if ":" in token:
        return token.split(":", 1)[0]
    return ""


def telegram_client_secret() -> str:
    # Must be BotFather → Web Login → Client Secret (NOT the bot token).
    return (settings.TELEGRAM_CLIENT_SECRET or "").strip()


def telegram_configured() -> bool:
    return bool(telegram_client_id() and telegram_client_secret())


def _b64url_sha256(value: str) -> str:
    digest = hashlib.sha256(value.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def start_telegram_oauth(redirect_uri: str) -> dict:
    if not telegram_configured():
        raise ValueError("TELEGRAM_NOT_CONFIGURED")

    allowed = [
        u.rstrip("/")
        for u in (settings.TELEGRAM_ALLOWED_REDIRECT_URIS or [])
        if u
    ]
    redirect_uri = redirect_uri.strip()
    if allowed and redirect_uri.rstrip("/") not in allowed:
        # also allow any URI whose origin matches CORS frontend list
        origins = [o.rstrip("/") for o in settings.CORS_ALLOWED_ORIGINS]
        if not any(redirect_uri.startswith(o + "/") or redirect_uri.rstrip("/") == o for o in origins):
            raise ValueError("INVALID_REDIRECT_URI")

    code_verifier = secrets.token_urlsafe(64)
    code_challenge = _b64url_sha256(code_verifier)
    state = secrets.token_urlsafe(24)

    TelegramOAuthState.objects.create(
        state=state,
        code_verifier=code_verifier,
        redirect_uri=redirect_uri,
        expires_at=timezone.now() + timedelta(minutes=30),
    )

    params = {
        "client_id": telegram_client_id(),
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid profile phone",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return {
        "success": True,
        "url": f"{TELEGRAM_AUTH}?{urlencode(params)}",
        "state": state,
    }


def _basic_auth_header(client_id: str, client_secret: str) -> str:
    raw = f"{client_id}:{client_secret}".encode("utf-8")
    return "Basic " + base64.b64encode(raw).decode("ascii")


def exchange_telegram_code(*, code: str, state: str) -> dict:
    """
    Exchange authorization code for ID token claims.
    Idempotent: a second call with the same state returns claims from the
    already-consumed login (via consumed_user) by raising a special path
    handled in complete_telegram_login.
    """
    row = TelegramOAuthState.objects.filter(state=state).first()
    if not row:
        raise ValueError("INVALID_STATE")
    if row.consumed_user_id:
        raise ValueError(f"ALREADY_CONSUMED:{row.consumed_user_id}")
    if row.is_expired:
        row.delete()
        raise ValueError("INVALID_STATE")

    body = urlencode(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": row.redirect_uri,
            "client_id": telegram_client_id(),
            "code_verifier": row.code_verifier,
        }
    ).encode("utf-8")

    req = Request(
        TELEGRAM_TOKEN,
        data=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": _basic_auth_header(
                telegram_client_id(), telegram_client_secret()
            ),
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        # Keep PKCE state so the user can retry once after a transient failure.
        raise ValueError(f"TOKEN_EXCHANGE_FAILED:{exc}") from exc

    id_token = payload.get("id_token")
    if not id_token:
        raise ValueError("MISSING_ID_TOKEN")

    jwks = PyJWKClient(TELEGRAM_JWKS)
    signing_key = jwks.get_signing_key_from_jwt(id_token)
    claims = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256", "ES256"],
        audience=telegram_client_id(),
        issuer="https://oauth.telegram.org",
        options={"require": ["exp", "iat", "sub"]},
    )
    # Attach row id so caller can mark consumed after user upsert.
    claims["_oauth_state_id"] = row.pk
    return claims


def mark_oauth_state_consumed(*, state_id: int, user: User) -> None:
    TelegramOAuthState.objects.filter(pk=state_id).update(
        consumed_user=user,
        consumed_at=timezone.now(),
    )


def complete_telegram_login(*, code: str, state: str) -> dict:
    """Full login: exchange code → upsert user → JWT (idempotent)."""
    row = TelegramOAuthState.objects.filter(state=state).first()
    if row and row.consumed_user_id:
        user = row.consumed_user
        if not user.is_active:
            raise ValueError("ACCOUNT_DISABLED")
        return issue_tokens(user)

    try:
        claims = exchange_telegram_code(code=code, state=state)
    except ValueError as exc:
        msg = str(exc)
        if msg.startswith("ALREADY_CONSUMED:"):
            user_id = int(msg.split(":", 1)[1])
            user = User.objects.filter(pk=user_id).first()
            if user:
                if not user.is_active:
                    raise ValueError("ACCOUNT_DISABLED")
                return issue_tokens(user)
        raise

    state_id = claims.pop("_oauth_state_id", None)
    user = upsert_telegram_user_from_claims(claims)
    if not user.is_active:
        raise ValueError("ACCOUNT_DISABLED")
    if state_id:
        mark_oauth_state_consumed(state_id=state_id, user=user)
    return issue_tokens(user)


def _phone_from_claims(claims: dict) -> str | None:
    raw = (claims.get("phone_number") or claims.get("phone") or "").strip()
    if not raw:
        return None
    normalized = normalize_phone(raw)
    return normalized or raw


def _can_set_phone(user: User | None, phone: str) -> bool:
    qs = User.objects.filter(phone=phone)
    if user is not None:
        qs = qs.exclude(pk=user.pk)
    return not qs.exists()


def upsert_telegram_user_from_claims(claims: dict) -> User:
    tg_id = str(claims.get("id") or claims.get("sub") or "")
    if not tg_id:
        raise ValueError("MISSING_USER_ID")

    name = (claims.get("name") or "").strip()
    given = (claims.get("given_name") or "").strip()
    family = (claims.get("family_name") or "").strip()
    username = (claims.get("preferred_username") or "").strip()
    full_name = name or f"{given} {family}".strip() or username or f"Telegram {tg_id}"
    phone = _phone_from_claims(claims)

    user = User.objects.filter(telegram_id=tg_id).first()
    if user:
        changed = []
        if full_name and user.full_name != full_name:
            user.full_name = full_name
            changed.append("full_name")
        if username and user.telegram_username != username:
            user.telegram_username = username
            changed.append("telegram_username")
        if phone and user.phone != phone and _can_set_phone(user, phone):
            user.phone = phone
            changed.append("phone")
        if changed:
            user.save(update_fields=changed)
        return user

    email = f"tg_{tg_id}@telegram.oauth.local"
    user = User(
        email=email,
        full_name=full_name,
        phone=phone if phone and _can_set_phone(None, phone) else None,
        telegram_id=tg_id,
        telegram_username=username,
        role=User.Role.STUDENT,
        is_active=True,
    )
    user.set_unusable_password()
    user.save()
    return user


def issue_tokens(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user).data,
    }
