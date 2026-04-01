from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import app_view, EmployeeViewSet, AttendanceViewSet, LeaveViewSet, PayrollViewSet, DashboardSummaryView, UserMeView

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'leave', LeaveViewSet, basename='leave')
router.register(r'payroll', PayrollViewSet, basename='payroll')

urlpatterns = [
    # API endpoints
    path('api/', include(router.urls)),
    path('api/dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('api/me/', UserMeView.as_view(), name='user-me'),
    
    # JWT Auth endpoints
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Catch-all for our SPA app view
    path('', app_view, name='app_entry'),
]
