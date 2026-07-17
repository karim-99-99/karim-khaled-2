"""Bunny Stream signed-URL helper.

Generates a token-authenticated embed URL. Until real Bunny keys are set in
.env, `is_configured()` returns False and callers fall back to a placeholder
so the app still runs end-to-end locally.
"""

import base64
import hashlib
import time

from django.conf import settings


def is_configured():
    return bool(
        settings.BUNNY_STREAM_LIBRARY_ID
        and settings.BUNNY_STREAM_TOKEN_KEY
        and settings.BUNNY_STREAM_CDN_HOSTNAME
    )


def signed_embed_url(video_id: str) -> dict:
    """
    Returns a dict describing how the frontend should play the video.

    When Bunny is configured, produces a real token-authenticated URL valid
    for BUNNY_TOKEN_TTL_SECONDS. Otherwise returns a placeholder marker.
    """
    if not video_id:
        return {"configured": False, "url": "", "expires": 0, "placeholder": True}

    if not is_configured():
        return {
            "configured": False,
            "placeholder": True,
            "video_id": video_id,
            "url": "",
            "expires": 0,
        }

    expires = int(time.time()) + settings.BUNNY_TOKEN_TTL_SECONDS
    library = settings.BUNNY_STREAM_LIBRARY_ID
    host = settings.BUNNY_STREAM_CDN_HOSTNAME
    token_key = settings.BUNNY_STREAM_TOKEN_KEY

    # Bunny token auth: SHA256(token_key + path + expires), base64url-encoded.
    path = f"/{video_id}/playlist.m3u8"
    raw = f"{token_key}{path}{expires}".encode()
    digest = hashlib.sha256(raw).digest()
    token = base64.urlsafe_b64encode(digest).decode().replace("=", "")

    url = f"https://{host}{path}?token={token}&expires={expires}"
    embed = f"https://iframe.mediadelivery.net/embed/{library}/{video_id}?token={token}&expires={expires}"
    return {
        "configured": True,
        "placeholder": False,
        "video_id": video_id,
        "url": url,
        "embed_url": embed,
        "expires": expires,
    }
