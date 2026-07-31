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
        expires_at=timezone.now() + timedelta(minutes=10),
    )

    params = {
        "client_id": telegram_client_id(),
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid profile",
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
    row = TelegramOAuthState.objects.filter(state=state).first()
    if not row or row.is_expired:
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
        raise ValueError(f"TOKEN_EXCHANGE_FAILED:{exc}") from exc
    finally:
        row.delete()

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
    return claims


def upsert_telegram_user_from_claims(claims: dict) -> User:
    tg_id = str(claims.get("id") or claims.get("sub") or "")
    if not tg_id:
        raise ValueError("MISSING_USER_ID")

    name = (claims.get("name") or "").strip()
    given = (claims.get("given_name") or "").strip()
    family = (claims.get("family_name") or "").strip()
    username = (claims.get("preferred_username") or "").strip()
    full_name = name or f"{given} {family}".strip() or username or f"Telegram {tg_id}"

    user = User.objects.filter(telegram_id=tg_id).first()
    if user:
        changed = []
        if full_name and user.full_name != full_name:
            user.full_name = full_name
            changed.append("full_name")
        if username and user.telegram_username != username:
            user.telegram_username = username
            changed.append("telegram_username")
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
