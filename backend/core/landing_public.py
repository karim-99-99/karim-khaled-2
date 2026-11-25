"""Public landing stats (Task 34) — next group remaining seats."""

from django.db.models import Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from groups.models import StudyGroup

# Brief: max 10 students per group
GROUP_CAPACITY = 10


@api_view(["GET"])
@permission_classes([AllowAny])
def landing_stats(request):
    """
    Remaining seats in the next open group (oldest group that still has room).
    seats_left = 0 → landing shows waitlist copy.
    """
    rows = (
        StudyGroup.objects.annotate(n=Count("student_links", distinct=True))
        .order_by("created_at", "id")
        .values("id", "name", "n")
    )
    chosen = None
    for g in rows:
        left = max(0, GROUP_CAPACITY - int(g["n"] or 0))
        if left > 0:
            chosen = {
                "group_id": g["id"],
                "group_name": g["name"],
                "seats_left": left,
                "capacity": GROUP_CAPACITY,
                "full": False,
            }
            break
    if chosen is None:
        # All full (or no groups) → waitlist
        last = list(rows)[-1] if rows else None
        chosen = {
            "group_id": last["id"] if last else None,
            "group_name": last["name"] if last else "",
            "seats_left": 0,
            "capacity": GROUP_CAPACITY,
            "full": True,
        }
    return Response(chosen)
