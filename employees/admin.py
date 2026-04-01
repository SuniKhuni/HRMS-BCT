from django.contrib import admin
from .models import Employee, Attendance, Leave, Payroll

admin.site.register(Employee)
admin.site.register(Attendance)
admin.site.register(Leave)
admin.site.register(Payroll)
