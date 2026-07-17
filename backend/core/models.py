from django.conf import settings
from django.db import models


class VideoView(models.Model):
    """Logs each signed-video request for account-sharing detection."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="video_views", on_delete=models.CASCADE
    )
    bunny_video_id = models.CharField(max_length=100)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    device_fingerprint = models.CharField(max_length=200, blank=True)
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-viewed_at"]


class AdminAuditLog(models.Model):
    """Records sensitive admin actions (activations, bans, extensions)."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="audit_actions",
        on_delete=models.SET_NULL,
        null=True,
    )
    action = models.CharField(max_length=120)
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
