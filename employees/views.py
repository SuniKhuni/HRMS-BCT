from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.exceptions import PermissionDenied

from .models import Employee, Attendance, Leave, Payroll
from .serializers import EmployeeSerializer, AttendanceSerializer, LeaveSerializer, PayrollSerializer


def app_view(request):
    """
    Serves the single-page application entry point (index.html),
    which mounts the React/Vanilla JS SaaS dashboard.
    """
    return render(request, 'index.html')


def _is_admin(user):
    return user and user.is_authenticated and (user.is_staff or user.is_superuser)


class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer

    def get_queryset(self):
        # Allow all users to see all employees so they can select from the list
        return Employee.objects.all()


class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer

    def get_queryset(self):
        user = self.request.user
        if _is_admin(user):
            return Attendance.objects.all()
        # Regular user: only their own attendance records
        return Attendance.objects.filter(employee__user=user)


class LeaveViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveSerializer

    def get_queryset(self):
        user = self.request.user
        if _is_admin(user):
            return Leave.objects.all()
        # Regular user: only their own leave requests
        return Leave.objects.filter(employee__user=user)

    def partial_update(self, request, *args, **kwargs):
        """Only admin/staff can change leave status (approve/reject)."""
        if 'status' in request.data and not _is_admin(request.user):
            raise PermissionDenied("Only admins can approve or reject leave requests.")
        return super().partial_update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        """Only admin/staff can change leave status (approve/reject)."""
        if 'status' in request.data and not _is_admin(request.user):
            raise PermissionDenied("Only admins can approve or reject leave requests.")
        return super().update(request, *args, **kwargs)


class PayrollViewSet(viewsets.ModelViewSet):
    serializer_class = PayrollSerializer

    def get_queryset(self):
        user = self.request.user
        if _is_admin(user):
            return Payroll.objects.all()
        # Regular employee: only their own payroll records (read-only)
        return Payroll.objects.filter(employee__user=user)

    def create(self, request, *args, **kwargs):
        """Only admins can add payroll records."""
        if not _is_admin(request.user):
            raise PermissionDenied("Only admins can create payroll records.")
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        """Only admins can update payroll records."""
        if not _is_admin(request.user):
            raise PermissionDenied("Only admins can update payroll records.")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """Only admins can update payroll records."""
        if not _is_admin(request.user):
            raise PermissionDenied("Only admins can update payroll records.")
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Only admins can delete payroll records."""
        if not _is_admin(request.user):
            raise PermissionDenied("Only admins can delete payroll records.")
        return super().destroy(request, *args, **kwargs)


class UserMeView(APIView):
    """Returns basic info about the currently authenticated user,
    including admin status and their linked employee ID (if any)."""
    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response({'is_admin': False, 'username': '', 'employee_id': None})

        employee_id = None
        employee_name = None
        try:
            profile = request.user.employee_profile
            employee_id = profile.id
            employee_name = profile.name
        except Exception:
            pass

        return Response({
            'is_admin': _is_admin(request.user),
            'username': request.user.username,
            'employee_id': employee_id,
            'employee_name': employee_name,
        })


class DashboardSummaryView(APIView):
    """API endpoint providing aggregated dashboard metrics."""
    def get(self, request):
        user = request.user

        if _is_admin(user):
            # Admin sees global stats
            total_employees = Employee.objects.count()
            present_today = Attendance.objects.filter(status__iexact='Present').count()
            on_leave = Leave.objects.filter(status__iexact='Approved').count()
            from django.db.models import Sum
            payroll_agg = Payroll.objects.aggregate(total=Sum('total_salary'))
            total_payroll = payroll_agg['total'] or 0
        else:
            # Regular user sees their own stats
            total_employees = Employee.objects.filter(user=user).count()
            present_today = Attendance.objects.filter(employee__user=user, status__iexact='Present').count()
            on_leave = Leave.objects.filter(employee__user=user, status__iexact='Approved').count()
            from django.db.models import Sum
            payroll_agg = Payroll.objects.filter(employee__user=user).aggregate(total=Sum('total_salary'))
            total_payroll = payroll_agg['total'] or 0

        return Response({
            'total_employees': total_employees,
            'present_today': present_today,
            'on_leave': on_leave,
            'total_payroll': total_payroll,
        })
