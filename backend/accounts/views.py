from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from core.permissions import IsAdmin
from groups.models import GroupStudent, GroupTeacher
from groups.serializers import AdminUserSerializer, _subscription_info
from .models import User
from .serializers import (
    EmailTokenObtainPairSerializer,
    RegisterSerializer,
    UserSerializer,
)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


@api_view(["GET"])
@permission_classes([IsAdmin])
def available_students(request):
    """Students who are NOT yet a member of ANY group (for the add-student picker)."""
    in_group_ids = GroupStudent.objects.values_list("student_id", flat=True)
    qs = User.objects.filter(role=User.Role.STUDENT).exclude(id__in=in_group_ids)
    search = request.query_params.get("search")
    if search:
        qs = qs.filter(full_name__icontains=search) | qs.filter(phone__icontains=search)
    return Response(AdminUserSerializer(qs.order_by("full_name"), many=True).data)


@api_view(["GET"])
@permission_classes([IsAdmin])
def teacher_list(request):
    """All teachers (a teacher can be assigned to several groups/subjects)."""
    qs = User.objects.filter(role=User.Role.TEACHER).order_by("full_name")
    return Response(AdminUserSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_accounts(request):
    """
    Directory of all accounts, split into students and teachers, with full
    per-person details for the admin.
    """
    students = []
    for u in User.objects.filter(role=User.Role.STUDENT).order_by("full_name"):
        groups = list(
            GroupStudent.objects.filter(student=u).values_list("group__name", flat=True)
        )
        students.append(
            {
                "id": u.id,
                "full_name": u.full_name,
                "phone": u.phone,
                "email": u.email,
                "gender": u.gender,
                "role": u.role,
                "is_active": u.is_active,
                "subscription": _subscription_info(u),
                "groups": groups,
                "groups_count": len(groups),
            }
        )

    teachers = []
    for u in User.objects.filter(role=User.Role.TEACHER).order_by("full_name"):
        links = GroupTeacher.objects.filter(teacher=u).select_related("group", "subject")
        group_names = sorted({l.group.name for l in links})
        subject_name = None
        if u.taught_subject_id:
            subject_name = u.taught_subject.name
        elif links:
            subject_name = links[0].subject.name
        teachers.append(
            {
                "id": u.id,
                "full_name": u.full_name,
                "phone": u.phone,
                "email": u.email,
                "role": u.role,
                "is_active": u.is_active,
                "subject_id": u.taught_subject_id,
                "subject_name": subject_name,
                "groups": group_names,
                "groups_count": len(group_names),
            }
        )

    return Response(
        {
            "students": students,
            "teachers": teachers,
            "totals": {"students": len(students), "teachers": len(teachers)},
        }
    )


@api_view(["PATCH", "POST"])
@permission_classes([IsAdmin])
def set_user_active(request, user_id):
    """Admin activates/deactivates an account. Inactive accounts cannot log in."""
    user = User.objects.filter(id=user_id).first()
    if not user:
        return Response({"detail": "المستخدم غير موجود"}, status=status.HTTP_404_NOT_FOUND)
    if user.is_admin_role:
        return Response(
            {"detail": "لا يمكن تعطيل حساب مدير"}, status=status.HTTP_400_BAD_REQUEST
        )
    user.is_active = bool(request.data.get("is_active", not user.is_active))
    user.save(update_fields=["is_active"])
    return Response(AdminUserSerializer(user).data)


@api_view(["PATCH", "POST"])
@permission_classes([IsAdmin])
def set_user_role(request, user_id):
    """Admin sets whether an account is a student or teacher (+ teacher subject)."""
    user = User.objects.filter(id=user_id).first()
    if not user:
        return Response({"detail": "المستخدم غير موجود"}, status=status.HTTP_404_NOT_FOUND)
    if user.is_admin_role:
        return Response(
            {"detail": "لا يمكن تعديل دور المدير"}, status=status.HTTP_400_BAD_REQUEST
        )
    role = request.data.get("role")
    if role not in (User.Role.STUDENT, User.Role.TEACHER):
        return Response({"detail": "دور غير صحيح"}, status=status.HTTP_400_BAD_REQUEST)
    user.role = role
    if role == User.Role.TEACHER:
        subject_id = request.data.get("taught_subject")
        if subject_id:
            user.taught_subject_id = subject_id
    else:
        user.taught_subject = None
    user.save()
    return Response(AdminUserSerializer(user).data)
