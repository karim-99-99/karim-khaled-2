from rest_framework import serializers

from .models import Session


class SessionSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = Session
        fields = [
            "id",
            "subject",
            "subject_name",
            "group",
            "teacher",
            "teacher_name",
            "start_time",
            "duration_minutes",
            "zoom_link",
            "status",
        ]
        read_only_fields = ["id"]
