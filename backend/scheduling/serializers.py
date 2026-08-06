from rest_framework import serializers

from .models import Session


class SessionSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True, default="")
    display_title = serializers.CharField(read_only=True)

    class Meta:
        model = Session
        fields = [
            "id",
            "title",
            "display_title",
            "subject",
            "subject_name",
            "group",
            "group_name",
            "teacher",
            "teacher_name",
            "start_time",
            "duration_minutes",
            "zoom_link",
            "status",
        ]
        read_only_fields = [
            "id",
            "display_title",
            "subject_name",
            "group_name",
            "teacher_name",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return
        # Teachers may only write Zoom (+ status); schedule fields stay read-only.
        if user.is_teacher and not user.is_admin_role:
            for name in (
                "title",
                "subject",
                "group",
                "teacher",
                "start_time",
                "duration_minutes",
            ):
                if name in self.fields:
                    self.fields[name].read_only = True
