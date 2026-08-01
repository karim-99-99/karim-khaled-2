from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from core.permissions import IsAdmin
from groups.models import GroupStudent, GroupTeacher
from groups.serializers import AdminUserSerializer, _subscription_info
from .models import User
from .serializers import (
    ChangePasswordSerializer,
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


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    """Change password: requires current password, then new password + confirm."""
    serializer = ChangePasswordSerializer(
        data=request.data, context={"request": request}
    )
    serializer.is_valid(raise_exception=True)
    request.user.set_password(serializer.validated_data["new_password"])
    request.user.save(update_fields=["password"])
    return Response({"detail": "تم تغيير كلمة المرور بنجاح"})


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
    for u in User.objects.filter(role=User.Role.STUDENT).order_by("-created_at"):
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
                "has_usable_password": u.has_usable_password(),
                "created_at": u.created_at,
                "subscription": _subscription_info(u),
                "groups": groups,
                "groups_count": len(groups),
            }
        )

    teachers = []
    for u in User.objects.filter(role=User.Role.TEACHER).order_by("-created_at"):
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
                "has_usable_password": u.has_usable_password(),
                "created_at": u.created_at,
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


@api_view(["PATCH", "POST"])
@permission_classes([IsAdmin])
def set_teacher_subject(request, user_id):
    """Admin changes a teacher's specialized subject (أي مادة → أخرى)."""
    from catalog.models import Subject

    user = User.objects.filter(id=user_id).first()
    if not user:
        return Response({"detail": "المستخدم غير موجود"}, status=status.HTTP_404_NOT_FOUND)
    if user.role != User.Role.TEACHER:
        return Response(
            {"detail": "هذا الحساب ليس مدرساً"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    subject_id = request.data.get("taught_subject")
    if not subject_id:
        return Response(
            {"detail": "المادة مطلوبة"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    subject = Subject.objects.filter(id=subject_id).first()
    if not subject:
        return Response({"detail": "المادة غير موجودة"}, status=status.HTTP_404_NOT_FOUND)

    user.taught_subject = subject
    user.save(update_fields=["taught_subject"])

    # Keep group assignments aligned with the teacher's subject.
    for link in GroupTeacher.objects.filter(teacher=user).select_related("group"):
        conflict = (
            GroupTeacher.objects.filter(
                group=link.group, teacher=user, subject=subject
            )
            .exclude(pk=link.pk)
            .exists()
        )
        if conflict:
            link.delete()
        elif link.subject_id != subject.id:
            link.subject = subject
            link.save(update_fields=["subject"])

    return Response(AdminUserSerializer(user).data)


@api_view(["PATCH", "POST"])
@permission_classes([IsAdmin])
def set_user_password(request, user_id):
    """
    Admin sets a new password for a user.
    Plaintext passwords are never stored or returned — only a new hash is saved.
    """
    user = User.objects.filter(id=user_id).first()
    if not user:
        return Response({"detail": "المستخدم غير موجود"}, status=status.HTTP_404_NOT_FOUND)
    if user.is_admin_role and user.id != request.user.id:
        return Response(
            {"detail": "لا يمكن تغيير كلمة مرور مدير آخر"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    password = (request.data.get("password") or "").strip()
    if len(password) < 6:
        return Response(
            {"detail": "كلمة المرور يجب أن تكون 6 أحرف على الأقل"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    user.set_password(password)
    user.save(update_fields=["password"])
    return Response(
        {
            "id": user.id,
            "full_name": user.full_name,
            "has_usable_password": True,
            "detail": "تم تعيين كلمة المرور بنجاح",
        }
    )
