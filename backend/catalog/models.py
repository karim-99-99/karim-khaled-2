from django.db import models


class Subject(models.Model):
    """A subject such as رياضيات. Fixed seed list, shared across all groups."""

    name = models.CharField(max_length=60, unique=True)
    slug = models.SlugField(max_length=60, unique=True)
    cover_gradient = models.CharField(
        max_length=120,
        blank=True,
        help_text="CSS gradient used on subject cards",
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.name


class Lesson(models.Model):
    """
    A تأسيس (foundation) lesson. Per the hybrid scoping decision, lessons and
    their videos are a SHARED library per subject (same for every group).
    Homework and question banks (in the assessments app) are group-scoped.
    """

    subject = models.ForeignKey(
        Subject, related_name="lessons", on_delete=models.CASCADE
    )
    created_by = models.ForeignKey(
        "accounts.User",
        related_name="lessons_created",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    order_number = models.PositiveIntegerField(default=1)
    title = models.CharField(max_length=200)
    # Bunny Stream video GUID (never a public URL).
    bunny_video_id = models.CharField(max_length=100, blank=True)
    pdf_url = models.URLField(blank=True)
    # Visible on the public home page to visitors / non-subscribers.
    is_free_preview = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["subject", "order_number", "id"]

    def __str__(self):
        return f"{self.subject.name} - {self.order_number}. {self.title}"
