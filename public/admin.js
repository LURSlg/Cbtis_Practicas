// public/admin.js - CONTROLADOR DEL PANEL DE ADMINISTRACIÓN

const SOLICITUDES_POLL_MS = 5000;
let solicitudesPollTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (window.waitForAuth) {
        await window.waitForAuth();
    }

    const session = window.authSession;
    const adminLock = document.getElementById('adminLock');
    const adminContent = document.getElementById('adminContent');
    const headerUserBadge = document.getElementById('headerUserBadge');

    if (session && session.loggedIn && session.user?.username === 'admin') {
        if (adminLock) adminLock.classList.add('hidden');
        if (adminContent) adminContent.style.display = 'block';
        if (headerUserBadge) headerUserBadge.textContent = `⚙️ ${session.user.username}`;

        initAdminTabs();
        initUserManagement();
        initSolicitudesPanel();
        startSolicitudesPolling();
    } else {
        if (adminLock) adminLock.classList.remove('hidden');
        if (adminContent) adminContent.style.display = 'none';
    }

    const adminLockLogin = document.getElementById('adminLockLogin');
    if (adminLockLogin) {
        adminLockLogin.addEventListener('click', () => {
            window.location.href = 'login.html';
        });
    }
});

function initAdminTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    const sections = document.querySelectorAll('.admin-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            tabs.forEach(t => t.classList.remove('admin-tab--active'));
            tab.classList.add('admin-tab--active');
            sections.forEach(section => {
                section.classList.toggle('hidden', section.id !== `tab-${targetTab}`);
            });
            if (targetTab === 'solicitudes') loadSolicitudes();
        });
    });
}

// ─── GESTIÓN DE USUARIOS ───────────────────────────────────────────

function initUserManagement() {
    document.getElementById('btnNewUser')?.addEventListener('click', () => openUserModal('create'));
    document.getElementById('userModalClose')?.addEventListener('click', closeUserModal);
    document.getElementById('userModalBackdrop')?.addEventListener('click', closeUserModal);
    document.getElementById('userModalSave')?.addEventListener('click', saveUser);

    loadUsers();
}

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/admin/usuarios', { cache: 'no-store' });
        if (!res.ok) throw new Error('No autorizado');
        const users = await res.json();

        tbody.innerHTML = '';
        users.filter(u => u.username !== 'admin').forEach(user => {
            const tr = document.createElement('tr');
            const estadoBadge = user.active
                ? '<span class="status-badge status-badge--success">Activo</span>'
                : '<span class="status-badge status-badge--danger">Inactivo</span>';
            tr.innerHTML = `
                <td class="debts-table__td"><strong>${escapeHtml(user.username)}</strong></td>
                <td class="debts-table__td">${escapeHtml(user.role || 'operador')}</td>
                <td class="debts-table__td">${estadoBadge}</td>
                <td class="debts-table__td" style="text-align:center;">
                    <button type="button" class="btn-table-action btn-table-action--success" data-edit="${escapeHtml(user.username)}">Editar</button>
                    <button type="button" class="btn-table-action btn-table-action--danger" data-delete="${escapeHtml(user.username)}">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (!users.filter(u => u.username !== 'admin').length) {
            tbody.innerHTML = '<tr><td class="debts-table__td" colspan="4" style="text-align:center;color:var(--color-muted);">No hay operadores registrados.</td></tr>';
        }

        tbody.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => openUserModal('edit', btn.getAttribute('data-edit')));
        });
        tbody.querySelectorAll('[data-delete]').forEach(btn => {
            btn.addEventListener('click', () => deleteUser(btn.getAttribute('data-delete')));
        });
    } catch {
        tbody.innerHTML = '<tr><td class="debts-table__td" colspan="4" style="text-align:center;color:var(--color-danger);">Error al cargar usuarios.</td></tr>';
    }
}

function openUserModal(mode, username = '') {
    const modal = document.getElementById('userModal');
    const modeInput = document.getElementById('userModalMode');
    const originalInput = document.getElementById('userModalOriginalUsername');
    const usernameInput = document.getElementById('umUsername');
    const passwordInput = document.getElementById('umPassword');
    const passwordHint = document.getElementById('umPasswordHint');
    const rolSelect = document.getElementById('umRol');
    const activoCheck = document.getElementById('umActivo');
    const errorNode = document.getElementById('userModalError');
    const title = document.getElementById('userModalTitle');
    const eyebrow = document.getElementById('userModalEyebrow');

    modeInput.value = mode;
    originalInput.value = username;
    errorNode.textContent = '';
    passwordInput.value = '';

    if (mode === 'create') {
        title.textContent = 'Crear usuario';
        eyebrow.textContent = 'Nuevo operador';
        usernameInput.value = '';
        usernameInput.disabled = false;
        passwordHint.textContent = 'Contraseña obligatoria para usuarios nuevos.';
        rolSelect.value = 'operador';
        activoCheck.checked = true;
    } else {
        title.textContent = `Editar: ${username}`;
        eyebrow.textContent = 'Modificar operador';
        usernameInput.value = username;
        usernameInput.disabled = true;
        passwordHint.textContent = 'Déjalo vacío para no cambiar la contraseña.';
        fetch('/api/admin/usuarios', { cache: 'no-store' })
            .then(r => r.json())
            .then(users => {
                const u = users.find(x => x.username === username);
                if (u) {
                    rolSelect.value = u.role || 'operador';
                    activoCheck.checked = u.active !== false;
                }
            });
    }

    modal.classList.remove('hidden');
}

function closeUserModal() {
    document.getElementById('userModal')?.classList.add('hidden');
}

async function saveUser() {
    const mode = document.getElementById('userModalMode').value;
    const username = document.getElementById('umUsername').value.trim();
    const password = document.getElementById('umPassword').value;
    const role = document.getElementById('umRol').value;
    const active = document.getElementById('umActivo').checked;
    const errorNode = document.getElementById('userModalError');

    errorNode.textContent = '';
    if (!username) {
        errorNode.textContent = 'El nombre de usuario es obligatorio.';
        return;
    }
    if (mode === 'create' && !password) {
        errorNode.textContent = 'La contraseña es obligatoria.';
        return;
    }

    try {
        const res = await fetch('/api/admin/usuarios/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, username, password, role, active }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
            closeUserModal();
            await loadUsers();
        } else {
            errorNode.textContent = data.error || 'Error al guardar.';
        }
    } catch {
        errorNode.textContent = 'Error de conexión.';
    }
}

async function deleteUser(username) {
    if (!confirm(`¿Eliminar al usuario "${username}"?`)) return;
    try {
        const res = await fetch(`/api/admin/usuarios/${encodeURIComponent(username)}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) await loadUsers();
        else alert(data.error || 'No se pudo eliminar.');
    } catch {
        alert('Error de conexión.');
    }
}

// ─── SOLICITUDES DE CUENTA ─────────────────────────────────────────

function initSolicitudesPanel() {
    document.getElementById('btnRefreshSolicitudes')?.addEventListener('click', loadSolicitudes);
}

function startSolicitudesPolling() {
    updateSolicitudesBadge();
    solicitudesPollTimer = setInterval(() => {
        updateSolicitudesBadge();
        const tab = document.getElementById('tab-solicitudes');
        if (tab && !tab.classList.contains('hidden')) loadSolicitudes(true);
    }, SOLICITUDES_POLL_MS);
}

async function updateSolicitudesBadge() {
    const badge = document.getElementById('solicitudesBadge');
    if (!badge) return;
    try {
        const res = await fetch('/api/admin/solicitudes/pendientes/count', { cache: 'no-store' });
        if (!res.ok) return;
        const { pending } = await res.json();
        badge.textContent = pending;
        badge.classList.toggle('hidden', pending === 0);
    } catch { /* ignore */ }
}

async function loadSolicitudes(silent = false) {
    const tbody = document.getElementById('solicitudesTableBody');
    if (!tbody) return;

    if (!silent) tbody.innerHTML = '<tr><td class="debts-table__td" colspan="5" style="text-align:center;color:var(--color-muted);">Cargando...</td></tr>';

    try {
        const res = await fetch('/api/admin/solicitudes?status=pending', { cache: 'no-store' });
        if (!res.ok) throw new Error('Error');
        const { data } = await res.json();

        tbody.innerHTML = '';
        if (!data.length) {
            tbody.innerHTML = '<tr><td class="debts-table__td" colspan="5" style="text-align:center;color:var(--color-muted);">No hay solicitudes pendientes.</td></tr>';
            return;
        }

        data.forEach(sol => {
            const tr = document.createElement('tr');
            const fecha = new Date(sol.createdAt).toLocaleString('es-MX');
            tr.innerHTML = `
                <td class="debts-table__td"><strong>${escapeHtml(sol.username)}</strong></td>
                <td class="debts-table__td">${escapeHtml(sol.nombreCompleto || '—')}</td>
                <td class="debts-table__td">${escapeHtml(sol.motivo || '—')}</td>
                <td class="debts-table__td">${fecha}</td>
                <td class="debts-table__td" style="text-align:center;">
                    <button type="button" class="btn-table-action btn-table-action--success" data-approve="${sol._id}">✓ Aprobar</button>
                    <button type="button" class="btn-table-action btn-table-action--danger" data-reject="${sol._id}">✕ Rechazar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('[data-approve]').forEach(btn => {
            btn.addEventListener('click', () => aprobarSolicitud(btn.getAttribute('data-approve')));
        });
        tbody.querySelectorAll('[data-reject]').forEach(btn => {
            btn.addEventListener('click', () => rechazarSolicitud(btn.getAttribute('data-reject')));
        });
    } catch {
        tbody.innerHTML = '<tr><td class="debts-table__td" colspan="5" style="text-align:center;color:var(--color-danger);">Error al cargar solicitudes.</td></tr>';
    }
}

async function aprobarSolicitud(id) {
    try {
        const res = await fetch(`/api/admin/solicitudes/${id}/aprobar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'operador' }),
        });
        const data = await res.json();
        if (res.ok) {
            await loadSolicitudes(true);
            await loadUsers();
            await updateSolicitudesBadge();
        } else {
            alert(data.error || 'No se pudo aprobar.');
        }
    } catch {
        alert('Error de conexión.');
    }
}

async function rechazarSolicitud(id) {
    const reason = prompt('Motivo del rechazo (opcional):') || '';
    try {
        const res = await fetch(`/api/admin/solicitudes/${id}/rechazar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
        const data = await res.json();
        if (res.ok) {
            await loadSolicitudes(true);
            await updateSolicitudesBadge();
        } else {
            alert(data.error || 'No se pudo rechazar.');
        }
    } catch {
        alert('Error de conexión.');
    }
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── CAMBIO DE CONTRASEÑA ADMIN ────────────────────────────────────

const btnChangePass = document.getElementById('btnChangePass');

if (btnChangePass) {
    btnChangePass.addEventListener('click', async () => {
        const currentPass = document.getElementById('currentPass').value;
        const newPass = document.getElementById('newPass').value;
        const confirmPass = document.getElementById('confirmPass').value;
        const securityQuestion = document.getElementById('securityQuestion')?.value;
        const securityAnswer = document.getElementById('securityAnswer')?.value;
        const errorNode = document.getElementById('passError');
        const successNode = document.getElementById('passSuccess');

        if (errorNode) errorNode.textContent = '';
        if (successNode) successNode.textContent = '';

        if (newPass !== confirmPass) {
            if (errorNode) errorNode.textContent = 'Las nuevas contraseñas no coinciden.';
            return;
        }

        try {
            const response = await fetch('/api/admin/update-mypassword', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPass, newPass, securityQuestion, securityAnswer }),
            });
            const result = await response.json();

            if (response.ok && result.success) {
                if (successNode) successNode.textContent = '✓ Cambios guardados con éxito.';
                document.getElementById('currentPass').value = '';
                document.getElementById('newPass').value = '';
                document.getElementById('confirmPass').value = '';
                if (document.getElementById('securityAnswer')) document.getElementById('securityAnswer').value = '';
            } else {
                if (errorNode) errorNode.textContent = result.error || 'Error al actualizar.';
            }
        } catch {
            if (errorNode) errorNode.textContent = 'Error de conexión con el servidor.';
        }
    });
}

window.addEventListener('beforeunload', () => {
    if (solicitudesPollTimer) clearInterval(solicitudesPollTimer);
});
