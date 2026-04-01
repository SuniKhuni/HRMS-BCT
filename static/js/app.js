// Initialize icons
lucide.createIcons();

// Elements
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

const sidebarLinks = document.querySelectorAll('.nav-item[data-view]');
const appSections = document.querySelectorAll('.app-section');

// State
let token = localStorage.getItem('access_token');
let isAdmin = false;           // true if logged-in user is staff/superuser
let currentEmployeeId = null;  // ID of the Employee record linked to this user
const BASE_URL = '/api/';

// Auth checking on load
if (token) {
    showApp();
    fetchUserRole().then(() => loadDashboardData());
} else {
    showLogin();
}

function showApp() {
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
}

function showLogin() {
    appView.classList.add('hidden');
    loginView.classList.remove('hidden');
}

// Navigation
sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();

        // Active state
        sidebarLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Show section
        const targetId = link.getAttribute('data-view');
        appSections.forEach(sec => sec.classList.add('hidden'));

        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.remove('hidden');
            if (targetId === 'dashboard-section') loadDashboardData();
            if (targetId === 'employees-section') loadEmployees();
            if (targetId === 'attendance-section') loadAttendanceSection();
            if (targetId === 'calendar-off') loadLeave();
            if (targetId === 'payroll-section') loadPayroll();
        }
    });
});

// Login Flow
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${BASE_URL}token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!res.ok) throw new Error('Invalid credentials');

        const data = await res.json();
        token = data.access;
        localStorage.setItem('access_token', token);
        localStorage.setItem('refresh_token', data.refresh);

        loginError.classList.add('hidden');
        showApp();
        await fetchUserRole();
        loadDashboardData();
    } catch (err) {
        loginError.classList.remove('hidden');
    }
});

// Logout Flow
logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    token = null;
    isAdmin = false;
    currentEmployeeId = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    showLogin();
});

// Fetch API Wrapper
async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

    if (res.status === 401) {
        logoutBtn.click();
        throw new Error('Unauthorized');
    }

    if (res.status === 204) return null;

    return await res.json();
}

// ─── Role & UI Setup ────────────────────────────────────────────────────────

async function fetchUserRole() {
    try {
        const me = await apiFetch('me/');
        isAdmin = me.is_admin === true;
        currentEmployeeId = me.employee_id || null;

        // Update topbar profile info
        const nameEl = document.querySelector('.profile-info .name');
        const roleEl = document.querySelector('.profile-info .role');
        if (nameEl) nameEl.textContent = me.employee_name || me.username;
        if (roleEl) roleEl.textContent = isAdmin ? 'HR Admin' : 'Employee';

        // Update avatar initials
        const avatarImg = document.querySelector('.avatar img');
        if (avatarImg) {
            const displayName = me.employee_name || me.username;
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0F3D2E&color=fff`;
        }

        // Apply role-based UI restrictions
        applyRoleUI();
    } catch (e) {
        isAdmin = false;
    }
}

function applyRoleUI() {
    // Nav items to show/hide for non-admins
    const employeesNav = document.querySelector('.nav-item[data-view="employees-section"]');
    const payrollNav   = document.querySelector('.nav-item[data-view="payroll-section"]');

    if (!isAdmin) {
        // Hide Employee management section — employees don't manage other employees
        if (employeesNav) employeesNav.style.display = 'none';
        // Payroll IS visible for employees — they can see their own salary slips
        if (payrollNav)   payrollNav.style.display   = '';

        // Hide Add Employee button
        const addEmpBtn = document.querySelector('button[onclick="openModal(\'add-employee-modal\')"]');
        if (addEmpBtn) addEmpBtn.style.display = 'none';

        // Hide Add Payroll button (employees can't add payroll)
        const addPayrollBtn = document.querySelector('button[onclick="openModal(\'add-payroll-modal\')"]');
        if (addPayrollBtn) addPayrollBtn.style.display = 'none';
    } else {
        if (employeesNav) employeesNav.style.display = '';
        if (payrollNav)   payrollNav.style.display   = '';
    }
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

async function loadDashboardData() {
    try {
        const data = await apiFetch('dashboard/summary/');
        animateValue("dash-total-emp", 0, data.total_employees, 1000);
        animateValue("dash-present",   0, data.present_today,   1000);
        animateValue("dash-leave",     0, data.on_leave,        1000);
        animateValue("dash-payroll",   0, data.total_payroll,   1500, true);
    } catch (e) { console.error('Error fetching dashboard', e); }
}

// ─── Employees ──────────────────────────────────────────────────────────────

async function loadEmployees() {
    try {
        const employees = await apiFetch('employees/');
        const tbody = document.querySelector('#emp-table tbody');
        tbody.innerHTML = '';

        // Admin: show full table with delete. Employee: read-only profile card.
        const addEmpBtn = document.querySelector('button[onclick="openModal(\'add-employee-modal\')"]');
        if (addEmpBtn) addEmpBtn.style.display = isAdmin ? '' : 'none';

        employees.forEach(emp => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${emp.name}</strong></td>
                <td>${emp.email}</td>
                <td><span style="background: var(--bg-main); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">${emp.department}</span></td>
                <td>$${parseFloat(emp.salary).toLocaleString()}</td>
                <td>
                    ${isAdmin ? `
                    <button class="px-icon-btn text-danger" onclick="deleteEmployee(${emp.id})">
                        <i data-lucide="trash-2"></i>
                    </button>` : '<span style="color:var(--text-muted);font-size:0.75rem;">—</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    } catch (e) { console.error(e); }
}

// ─── Attendance ──────────────────────────────────────────────────────────────

// Dispatcher: admin vs employee view
async function loadAttendanceSection() {
    if (isAdmin) {
        await loadAttendanceAdmin();
    } else {
        await loadAttendanceEmployee();
    }
}

// ADMIN: mark attendance for all employees
async function loadAttendanceAdmin() {
    try {
        const employees = await apiFetch('employees/');
        const thead = document.querySelector('#att-table thead tr');
        const tbody = document.querySelector('#att-table tbody');
        thead.innerHTML = '<th>Employee</th><th>Status (Toggle)</th>';
        tbody.innerHTML = '';

        employees.forEach(emp => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${emp.name}</strong></td>
                <td>
                    <label style="margin-right: 12px; cursor: pointer; color: var(--success);">
                        <input type="radio" name="att_${emp.id}" value="Present" checked> Present
                    </label>
                    <label style="cursor: pointer; color: var(--danger);">
                        <input type="radio" name="att_${emp.id}" value="Absent"> Absent
                    </label>
                </td>
            `;
            tr.dataset.empId = emp.id;
            tbody.appendChild(tr);
        });

        document.getElementById('save-attendance-btn').style.display = '';
        const selfBtn = document.getElementById('mark-self-attendance-btn');
        if (selfBtn) selfBtn.style.display = 'none';

        const secP = document.querySelector('#attendance-section .section-header p');
        if (secP) secP.textContent = 'Mark daily attendance for all employees';
    } catch (e) { console.error('Error loading admin attendance', e); }
}

// EMPLOYEE: view their own attendance history
async function loadAttendanceEmployee() {
    try {
        const thead = document.querySelector('#att-table thead tr');
        const tbody = document.querySelector('#att-table tbody');
        thead.innerHTML = '<th>Date</th><th>Status</th>';
        tbody.innerHTML = '';

        // Hide the mark-attendance controls for admin
        document.getElementById('save-attendance-btn').style.display = 'none';
        document.getElementById('attendance-date').style.display = 'none';
        document.querySelector('#attendance-section .section-header p').textContent = 'Your personal attendance history';
        
        const selfBtn = document.getElementById('mark-self-attendance-btn');

        const attData = await apiFetch('attendance/');

        if (attData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;padding:24px;color:var(--text-muted);">No attendance records found for your account.</td></tr>';
            return;
        }

        // Sort newest first
        attData.sort((a, b) => new Date(b.date) - new Date(a.date));
        attData.forEach(att => {
            const color = att.status.toLowerCase() === 'present' ? 'var(--success)' : 'var(--danger)';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${att.date}</td>
                <td><span style="background:${color}22;color:${color};padding:4px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;">${att.status}</span></td>
            `;
            tbody.appendChild(tr);
        });

        // Handle the check-in button state
        const todayStr = new Date().toISOString().split('T')[0];
        const hasCheckedIn = attData.some(a => a.date === todayStr);

        if (selfBtn) {
            selfBtn.style.display = '';
            if (hasCheckedIn) {
                selfBtn.innerHTML = '<i data-lucide="check-check"></i> Checked In';
                selfBtn.disabled = true;
                selfBtn.classList.remove('btn-primary');
                selfBtn.classList.add('btn-secondary');
            } else {
                selfBtn.innerHTML = '<i data-lucide="check-circle"></i> Mark Present Today';
                selfBtn.disabled = false;
                selfBtn.classList.remove('btn-secondary');
                selfBtn.classList.add('btn-primary');
            }
        }
    } catch (e) { console.error('Error loading employee attendance', e); }
}

document.getElementById('mark-self-attendance-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!currentEmployeeId) return alert('No employee profile linked to your account. Contact an admin.');

    const payload = {
        employee: currentEmployeeId,
        date: new Date().toISOString().split('T')[0],
        status: 'Present'
    };

    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = 'Saving...';

    try {
        await apiFetch('attendance/', { method: 'POST', body: JSON.stringify(payload) });
        showToast('You have successfully checked in for today!');
        loadAttendanceEmployee(); // Refresh table and button state
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check-circle"></i> Mark Present Today';
        alert('Failed to mark check-in. You might have already checked in.');
    }
});

document.getElementById('save-attendance-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const dateVal = document.getElementById('attendance-date').value;
    if (!dateVal) return alert('Select a date');

    const rows = document.querySelectorAll('#att-table tbody tr');
    let errors = 0;

    e.target.disabled = true;
    e.target.innerText = 'Saving...';

    for (let row of rows) {
        const empId = row.dataset.empId;
        const status = document.querySelector(`input[name="att_${empId}"]:checked`).value;
        const payload = { employee: empId, date: dateVal, status: status };
        try {
            await apiFetch('attendance/', { method: 'POST', body: JSON.stringify(payload) });
        } catch (err) {
            errors++;
        }
    }

    e.target.disabled = false;
    e.target.innerText = 'Save Attendance';

    if (errors > 0) alert('Some records failed. They may already exist for this date.');
    else showToast('Attendance saved for all employees!');
});

// ─── Modals ──────────────────────────────────────────────────────────────────

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.target.closest('.modal-backdrop').classList.add('hidden');
    });
});

// ─── Employees CRUD ──────────────────────────────────────────────────────────

document.getElementById('save-emp-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    const payload = {
        name:       document.getElementById('emp-name').value,
        email:      document.getElementById('emp-email').value,
        department: document.getElementById('emp-dept').value,
        salary:     document.getElementById('emp-salary').value,
    };

    try {
        await apiFetch('employees/', { method: 'POST', body: JSON.stringify(payload) });
        document.getElementById('add-employee-modal').classList.add('hidden');
        document.getElementById('add-employee-form').reset();
        showToast('Employee added successfully');
        loadEmployees();
    } catch (e) {
        alert('Failed to save employee');
    }
});

async function deleteEmployee(id) {
    if (!confirm("Are you sure?")) return;
    try {
        await apiFetch(`employees/${id}/`, { method: 'DELETE' });
        showToast('Employee deleted');
        loadEmployees();
    } catch (e) { console.error(e); }
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.querySelector('.toast-message').textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ─── Leave ───────────────────────────────────────────────────────────────────

async function loadLeave() {
    try {
        const leaveData = await apiFetch('leave/');
        const tbody = document.querySelector('#leave-table tbody');
        tbody.innerHTML = '';

        if (leaveData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">No leave requests found.</td></tr>';
        }

        leaveData.forEach(l => {
            let color = 'var(--text-muted)';
            if (l.status.toLowerCase() === 'approved') color = 'var(--success)';
            if (l.status.toLowerCase() === 'pending')  color = 'var(--warning)';
            if (l.status.toLowerCase() === 'rejected') color = 'var(--danger)';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${l.employee_name}</strong></td>
                <td>${l.reason}</td>
                <td>${l.start_date} to ${l.end_date}</td>
                <td><span style="background:${color}22;color:${color};padding:4px 8px;border-radius:12px;font-size:0.75rem;font-weight:600;">${l.status}</span></td>
                <td>
                    ${isAdmin && l.status.toLowerCase() === 'pending' ? `
                    <button class="px-icon-btn text-success" onclick="updateLeaveStatus(${l.id}, 'Approved')" title="Approve">
                        <i data-lucide="check"></i>
                    </button>
                    <button class="px-icon-btn text-warning" onclick="updateLeaveStatus(${l.id}, 'Rejected')" title="Reject">
                        <i data-lucide="x"></i>
                    </button>
                    ` : ''}
                    ${!isAdmin && l.status.toLowerCase() === 'pending' ? `
                    <button class="px-icon-btn text-danger" onclick="deleteLeave(${l.id})" title="Cancel Request">
                        <i data-lucide="trash-2"></i>
                    </button>` : ''}
                    ${isAdmin ? `
                    <button class="px-icon-btn text-danger" onclick="deleteLeave(${l.id})" title="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Populate employee dropdown in the Apply Leave modal
        const sel = document.getElementById('leave-emp-id');
        const selWrapper = sel.closest('.form-group');

        selWrapper.style.display = '';
        const employees = await apiFetch('employees/');
        sel.innerHTML = '<option value="" disabled selected>Select Employee</option>';
        employees.forEach(emp => {
            const isMe = emp.id === currentEmployeeId ? ' (Me)' : '';
            sel.innerHTML += `<option value="${emp.id}">${emp.name}${isMe}</option>`;
        });
        sel.disabled = false;

        // Auto-select the user's own profile if linked, but allow them to change it
        if (!isAdmin && currentEmployeeId) {
            sel.value = currentEmployeeId;
        }

        lucide.createIcons();
    } catch (e) { console.error('Error fetching leave', e); }
}

async function updateLeaveStatus(id, newStatus) {
    try {
        await apiFetch(`leave/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
        showToast(`Leave marked as ${newStatus}`);
        loadLeave();
    } catch (e) { console.error(e); }
}

async function deleteLeave(id) {
    if (!confirm("Are you sure?")) return;
    try {
        await apiFetch(`leave/${id}/`, { method: 'DELETE' });
        showToast('Leave request removed');
        loadLeave();
    } catch (e) { console.error(e); }
}

document.getElementById('save-leave-btn').addEventListener('click', async (e) => {
    e.preventDefault();

    const empId = document.getElementById('leave-emp-id').value;

    const payload = {
        employee:   empId,
        reason:     document.getElementById('leave-reason').value,
        start_date: document.getElementById('leave-start').value,
        end_date:   document.getElementById('leave-end').value,
        status:     'Pending'
    };

    if (!payload.employee) return alert('No employee profile linked to your account. Please contact admin.');
    if (!payload.start_date || !payload.end_date) return alert('Please fill in all required fields.');

    try {
        await apiFetch('leave/', { method: 'POST', body: JSON.stringify(payload) });
        document.getElementById('apply-leave-modal').classList.add('hidden');
        document.getElementById('apply-leave-form').reset();
        showToast('Leave request submitted successfully!');
        loadLeave();
    } catch (e) {
        alert('Failed to submit leave request.');
    }
});

// ─── Payroll ─────────────────────────────────────────────────────────────────

async function loadPayroll() {
    try {
        const payrollData = await apiFetch('payroll/');
        const tbody = document.querySelector('#payroll-table tbody');
        const thead = document.querySelector('#payroll-table thead tr');
        tbody.innerHTML = '';

        // ── Section header & Add button ──────────────────────────────────────
        const addPayrollBtn = document.querySelector('button[onclick="openModal(\'add-payroll-modal\')"]');
        const sectionTitle = document.querySelector('#payroll-section .section-header h1');
        const sectionSub   = document.querySelector('#payroll-section .section-header p');

        if (isAdmin) {
            if (addPayrollBtn) addPayrollBtn.style.display = '';
            if (sectionTitle) sectionTitle.textContent = 'Monthly Payroll';
            if (sectionSub)   sectionSub.textContent   = 'Manage and distribute salaries for all employees';
        } else {
            if (addPayrollBtn) addPayrollBtn.style.display = 'none';
            if (sectionTitle) sectionTitle.textContent = 'My Salary Slips';
            if (sectionSub)   sectionSub.textContent   = 'Your personal salary payment history';
        }

        // ── Table columns ────────────────────────────────────────────────────
        if (isAdmin) {
            thead.innerHTML = '<th>Employee</th><th>Month</th><th>Total Paid</th><th>Actions</th>';
        } else {
            // Employee: only their own record — no name column, no actions
            thead.innerHTML = '<th>Month</th><th>Salary Received</th><th>Status</th>';
        }

        let total = 0;

        if (payrollData.length === 0) {
            const cols = isAdmin ? 4 : 3;
            const emptyMsg = isAdmin
                ? 'No payroll records found.'
                : 'No salary records found for your account. Please contact HR.';
            tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:32px;color:var(--text-muted);">${emptyMsg}</td></tr>`;
        }

        payrollData.forEach(p => {
            total += parseFloat(p.total_salary);
            const tr = document.createElement('tr');

            if (isAdmin) {
                tr.innerHTML = `
                    <td><strong>${p.employee_name}</strong></td>
                    <td>${p.month}</td>
                    <td><strong style="color:var(--primary);">$${parseFloat(p.total_salary).toLocaleString()}</strong></td>
                    <td>
                        <button class="px-icon-btn text-danger" onclick="deletePayroll(${p.id})" title="Delete record">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </td>
                `;
            } else {
                // Employee view: salary slip card style with a "Paid" badge
                tr.innerHTML = `
                    <td><strong>${p.month}</strong></td>
                    <td>
                        <span style="font-size:1.1rem;font-weight:700;color:var(--primary);">$${parseFloat(p.total_salary).toLocaleString()}</span>
                    </td>
                    <td>
                        <span style="background:var(--success)22;color:var(--success);padding:4px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;">✓ Paid</span>
                    </td>
                `;
            }
            tbody.appendChild(tr);
        });

        // ── Footer total label ───────────────────────────────────────────────
        const totalLabelEl = document.querySelector('#payroll-section .card > div:last-child span:first-child');
        const totalDisplay  = document.getElementById('payroll-total-display');

        if (totalLabelEl) {
            totalLabelEl.textContent = isAdmin ? 'Total Cycle Distribution:' : 'Your Total Earnings:';
        }
        totalDisplay.innerText = '$' + total.toLocaleString();

        // ── Populate employee dropdown in Add Payroll modal (admin only) ────
        if (isAdmin) {
            const employees = await apiFetch('employees/');
            const sel = document.getElementById('payroll-emp-id');
            if (sel) {
                sel.innerHTML = '<option value="" disabled selected>Select Employee</option>';
                employees.forEach(emp => {
                    sel.innerHTML += `<option value="${emp.id}">${emp.name}</option>`;
                });
            }
        }

        lucide.createIcons();
    } catch (e) { console.error('Error fetching payroll', e); }
}

async function deletePayroll(id) {
    if (!confirm("Are you sure?")) return;
    try {
        await apiFetch(`payroll/${id}/`, { method: 'DELETE' });
        showToast('Payroll record removed');
        loadPayroll();
    } catch (e) { console.error(e); }
}

document.getElementById('save-payroll-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const payload = {
        employee:     document.getElementById('payroll-emp-id').value,
        month:        document.getElementById('payroll-month').value,
        total_salary: document.getElementById('payroll-salary').value
    };
    if (!payload.employee || !payload.month || !payload.total_salary) return alert('Fill required fields');

    try {
        await apiFetch('payroll/', { method: 'POST', body: JSON.stringify(payload) });
        document.getElementById('add-payroll-modal').classList.add('hidden');
        document.getElementById('add-payroll-form').reset();
        showToast('Payroll record added successfully');
        loadPayroll();
    } catch (e) {
        alert('Failed to save payroll');
    }
});

// ─── Utility ─────────────────────────────────────────────────────────────────

function animateValue(id, start, end, duration, currency = false) {
    if (start === end) return;
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        obj.innerHTML = currency ? '$' + current.toLocaleString() : current;
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}
