/* public/main.js — Módulo de Validación Inmediata (MongoDB + Zero Trust UI) */

const MAX_SUGGESTIONS = 6;
const SEARCH_DEBOUNCE_MS = 300;
const HEALTH_INTERVAL_MS = 30000;

const idControlInput = document.getElementById('idControl');
const formRegistration = document.getElementById('registrationForm');
const alertBanner = document.getElementById('alertBanner');
const debtsTableBody = document.getElementById('debtsTableBody');
const semestreSelect = document.getElementById('semestre');
const btnSubmit = document.getElementById('btnSubmit');
const tipoReferenciaSelect = document.getElementById('tipoReferencia');
const referenciaInput = document.getElementById('referencia');
const suggestionsContainer = document.getElementById('suggestionsContainer');
const countSuccessEl = document.getElementById('countSuccess');
const countTotalEl = document.getElementById('countTotal');
const activityLog = document.getElementById('activityLog');
const statusDot = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');

let searchDebounceTimer = null;
let currentStudentData = null;

async function initApp() {
    resetFormularyState();
    inicializarCarrerasDinamicas(); // 👈 Carga las carreras desde el Excel al arrancar
    await loadTurnoResumen();
    await loadTurnoMovimientos();
    startHealthMonitor();
}

if (window.waitForAuth) {
    window.waitForAuth().then(() => {
        if (window.authSession && !window.authSession.loggedIn) return;
        initApp();
    }).catch(err => console.error('Error in auth guard:', err));
} else {
    setTimeout(initApp, 100);
}

window.addEventListener('auth:login', () => initApp());

document.addEventListener('click', (e) => {
    if (!e.target.closest('.form__group--priority')) {
        suggestionsContainer.classList.remove('visible');
    }
});

function startHealthMonitor() {
    const check = async () => {
        try {
            const res = await fetch('/api/health', { cache: 'no-store' });
            const data = await res.json();
            setTerminalStatus(data.ok);
        } catch {
            setTerminalStatus(false);
        }
    };
    check();
    setInterval(check, HEALTH_INTERVAL_MS);
}

function setTerminalStatus(online) {
    if (!statusDot) return;
    statusDot.classList.toggle('status-indicator__dot--offline', !online);
    if (statusLabel) {
        statusLabel.textContent = online
            ? 'Sistema Conectado • Turno Activo'
            : 'Sin conexión al servidor';
    }
}

async function loadTurnoResumen() {
    try {
        const res = await fetch('/api/turno/resumen', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        countSuccessEl.textContent = data.validados ?? 0;
        countTotalEl.textContent = data.totalOperaciones ?? 0;
    } catch (err) {
        console.warn('No se pudo cargar resumen de turno:', err);
    }
}

async function loadTurnoMovimientos() {
    try {
        const res = await fetch('/api/turno/movimientos?limit=15', { cache: 'no-store' });
        if (!res.ok) return;
        const { data } = await res.json();
        if (!data?.length) return;

        activityLog.innerHTML = '';
        data.forEach(m => {
            const accion = m.accion === 'PAGAR' ? 'Pago registrado' : 'Pago revertido';
            const ref = m.referencia ? ` · Ref: ${m.tipoReferencia} ${m.referencia}` : '';
            appendActivityLog(`[${m.hora}] ID: ${m.control} - ${accion} ${m.semestre}° Sem.${ref}`, m.accion === 'REVERTIR');
        });
    } catch (err) {
        console.warn('No se pudieron cargar movimientos:', err);
    }
}

function appendActivityLog(message, isRevert = false) {
    const log = document.createElement('div');
    log.className = 'activity-log__item';
    if (isRevert) log.style.color = 'var(--color-danger)';
    const match = message.match(/^(\[[^\]]+\])\s*(.*)$/);
    if (match) {
        log.innerHTML = `<span class="activity-log__time">${match[1]}</span> ${match[2]}`;
    } else {
        log.textContent = message;
    }
    activityLog.insertBefore(log, activityLog.firstChild);
}

idControlInput.addEventListener('input', (e) => {
    const currentId = e.target.value.trim().replace(/\D/g, '');
    if (e.target.value !== currentId) e.target.value = currentId;

    if (!currentId.length) {
        resetFormularyState();
        return;
    }

    if (currentId.length === 14) {
        loadStudentFromServer(currentId);
        suggestionsContainer.classList.remove('visible');
        suggestionsContainer.innerHTML = '';
        return;
    }

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => updateSuggestions(currentId), SEARCH_DEBOUNCE_MS);
});

async function loadStudentFromServer(controlId) {
    try {
        const res = await fetch(`/api/students/${controlId}/payments`, { cache: 'no-store' });
        if (!res.ok) {
            showAlert('Matrícula no registrada. Puede registrarla como nuevo ingreso.', 'info');
            habilitarSemestresNuevoIngreso();
            return;
        }
        const data = await res.json();
        currentStudentData = data.student;
        fillAlumnoFieldsFromServer(data.student);
        renderDebtsFromServer(data);
        showAlert('✓ Alumno encontrado: datos cargados desde el servidor.', 'success');
    } catch (err) {
        showAlert('✗ Error al consultar el servidor.', 'danger');
    }
}

async function updateSuggestions(prefix) {
    if (!prefix) {
        suggestionsContainer.classList.remove('visible');
        return;
    }

    try {
        const res = await fetch(`/api/alumnos/search?q=${encodeURIComponent(prefix)}&limit=${MAX_SUGGESTIONS}`, { cache: 'no-store' });
        const { data: candidates } = await res.json();

        if (!candidates.length) {
            suggestionsContainer.classList.add('visible');
            suggestionsContainer.innerHTML = '<div class="suggestions-panel__empty">Sin coincidencias</div>';
            return;
        }

        suggestionsContainer.classList.add('visible');
        suggestionsContainer.innerHTML = '';
        candidates.forEach(item => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'suggestions-panel__item';
            option.innerHTML = `
                <div class="suggestions-panel__id">${item.control}</div>
                <div class="suggestions-panel__meta">${item.nombre} ${item.apellidos}<br>${item.carrera}</div>
            `;
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                idControlInput.value = item.control;
                suggestionsContainer.classList.remove('visible');
                loadStudentFromServer(item.control);
            });
            suggestionsContainer.appendChild(option);
        });
    } catch {
        suggestionsContainer.classList.remove('visible');
    }
}

function fillAlumnoFieldsFromServer(student) {
    document.getElementById('nombre').value = student.nombre || '';
    document.getElementById('apellido_paterno').value = student.apellido_paterno || '';
    document.getElementById('apellido_materno').value = student.apellido_materno || '';
    
    // Selecciona automáticamente la opción correcta basándose en el string del Excel
    const carreraSelect = document.getElementById('carrera');
    if (carreraSelect && student.carrera) {
        carreraSelect.value = student.carrera.trim().toUpperCase();
    } else if (carreraSelect) {
        carreraSelect.value = '';
    }
}

// ==========================================================================
// FUNCIÓN AUTO-FILL: EXTRAE LAS CARRERAS DEL EXCEL DE FORMA DINÁMICA
// ==========================================================================
function inicializarCarrerasDinamicas() {
    const selectCarrera = document.getElementById('carrera');
    if (!selectCarrera) return;

    selectCarrera.innerHTML = '<option value="">Cargando especialidades oficiales...</option>';

    fetch('/api/info/carreras', { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
            if (data && data.success && data.carreras && data.carreras.length > 0) {
                selectCarrera.innerHTML = '<option value="">- Seleccione Especialidad -</option>';
                
                data.carreras.forEach(carrera => {
                    const option = document.createElement('option');
                    // Almacena el valor idéntico al Excel en mayúsculas sostenidas para el match perfecto
                    option.value = carrera.trim().toUpperCase(); 
                    option.textContent = normalizarTextoCarrera(carrera);
                    selectCarrera.appendChild(option);
                });
            } else {
                selectCarrera.innerHTML = '<option value="">No se encontraron especialidades en Excel</option>';
            }
        })
        .catch(err => {
            console.error('❌ Error cargando las carreras en el formulario:', err);
            selectCarrera.innerHTML = '<option value="">Error al conectar con la base de datos Excel</option>';
        });
}

function normalizarTextoCarrera(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .split(' ')
        .map((palabra, index, arr) => {
            if (['de', 'y', 'en', 'del', 'los', 'las'].includes(palabra) && index !== 0) {
                return palabra;
            }
            return palabra.charAt(0).toUpperCase() + palabra.slice(1);
        })
        .join(' ');
}

function renderDebtsFromServer(data) {
    debtsTableBody.innerHTML = '';
    semestreSelect.innerHTML = '<option value="">Seleccione...</option>';
    let tieneAdeudos = false;
    const controlId = data.student.noControl;

    data.history.forEach(item => {
        const isPaid = item.abonado > 0;
        const badgeClass = isPaid ? 'status-badge--success' : 'status-badge--danger';
        const statusText = isPaid ? 'PAGADO' : 'ADEUDO';
        const toggleText = isPaid ? '✕ Quitar' : '✓ Validar';
        const toggleClass = isPaid ? 'btn-table-action--danger' : 'btn-table-action--success';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="debts-table__td">${item.periodo}° Semestre</td>
            <td class="debts-table__td"><span class="status-badge ${badgeClass}">${statusText}</span></td>
            <td class="debts-table__td">
                <div class="debts-table__actions-wrapper">
                    <button type="button" class="btn-table-action ${toggleClass}"
                            data-action="toggle-pago" data-sem="${item.periodo}" data-paid="${isPaid}">
                        ${toggleText}
                    </button>
                </div>
            </td>
        `;
        debtsTableBody.appendChild(tr);

        if (!isPaid) {
            tieneAdeudos = true;
            const opt = document.createElement('option');
            opt.value = item.periodo;
            opt.textContent = `${item.periodo}° Semestre`;
            semestreSelect.appendChild(opt);
        }
    });

    debtsTableBody.querySelectorAll('[data-action="toggle-pago"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const sem = btn.getAttribute('data-sem');
            const currentlyPaid = btn.getAttribute('data-paid') === 'true';
            if (currentlyPaid) {
                await modificarPagoBackend(controlId, sem, false);
            } else {
                await registrarPagoBackend(controlId, sem);
            }
        });
    });

    semestreSelect.disabled = !tieneAdeudos;
    btnSubmit.disabled = !tieneAdeudos;
    setComprobanteEnabled(tieneAdeudos);
    if (!tieneAdeudos) {
        semestreSelect.innerHTML = '<option value="">Sin adeudos</option>';
    }

    const summary = document.getElementById('debtsSummary');
    if (summary) {
        summary.textContent = `$${data.summary.totalPaid.toFixed(0)} pagado · $${data.summary.totalDebt.toFixed(0)} adeudo`;
    }
}

function habilitarSemestresNuevoIngreso() {
    semestreSelect.innerHTML = '<option value="">Seleccione...</option>';
    for (let i = 1; i <= 6; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${i}° Semestre`;
        semestreSelect.appendChild(opt);
    }
    semestreSelect.disabled = false;
    btnSubmit.disabled = false;
    setComprobanteEnabled(true);
    debtsTableBody.innerHTML = `<tr><td class="debts-table__td" colspan="3" style="color: var(--color-warning); text-align: center;">Alumno nuevo: complete los datos y registre el pago.</td></tr>`;
}

function resetFormularyState() {
    currentStudentData = null;
    document.getElementById('nombre').disabled = false;
    document.getElementById('apellido_paterno').disabled = false;
    document.getElementById('apellido_materno').disabled = false;
    document.getElementById('carrera').disabled = false;

    if (idControlInput.value.trim() === '') {
        document.getElementById('nombre').value = '';
        document.getElementById('apellido_paterno').value = '';
        document.getElementById('apellido_materno').value = '';
        document.getElementById('carrera').value = '';
    }

    debtsTableBody.innerHTML = `<tr><td class="debts-table__td" colspan="3" style="color: var(--color-muted); text-align: center;">Ingrese un número de control para consultar</td></tr>`;
    semestreSelect.innerHTML = '<option value="">Seleccione...</option>';
    semestreSelect.disabled = true;
    btnSubmit.disabled = true;
    setComprobanteEnabled(false);
    clearComprobanteFields();
    suggestionsContainer.innerHTML = '';
    suggestionsContainer.classList.remove('visible');

    const summary = document.getElementById('debtsSummary');
    if (summary) summary.textContent = '—';
}

formRegistration.addEventListener('submit', async (e) => {
    e.preventDefault();
    const control = idControlInput.value.trim();
    const semestre = semestreSelect.value;
    if (!semestre) {
        showAlert('✗ Seleccione un semestre.', 'danger');
        return;
    }
    if (!tipoReferenciaSelect.value || !referenciaInput.value.trim()) {
        showAlert('✗ Indique tipo y referencia del comprobante de pago.', 'danger');
        return;
    }
    if (!control || control.length !== 14) {
        showAlert('✗ El número de control debe tener 14 dígitos.', 'danger');
        return;
    }
    await registrarPagoBackend(control, semestre, true);
});

async function registrarPagoBackend(controlId, semesterNum, fromForm = false) {
    const tipo = tipoReferenciaSelect?.value;
    const ref = referenciaInput?.value?.trim();
    if (!tipo || !ref) {
        showAlert('✗ Indique tipo y referencia del comprobante antes de registrar el pago.', 'danger');
        return;
    }

    const payload = {
        control: controlId,
        semestre: semesterNum,
        estadoPago: true,
        tipoReferencia: tipo,
        referencia: ref,
    };

    if (fromForm) {
        payload.nombre = document.getElementById('nombre').value.trim();
        payload.paterno = document.getElementById('apellido_paterno').value.trim();
        payload.materno = document.getElementById('apellido_materno').value.trim();
        payload.carrera = document.getElementById('carrera').value; // Manda el string limpio del Excel
    }

    try {
        const response = await fetch('/api/registrar-pago', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));

        if (response.ok) {
            const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const refTxt = payload.referencia ? ` · ${payload.tipoReferencia}: ${payload.referencia}` : '';
            appendActivityLog(`[${hora}] ID: ${controlId} - Pago ${semesterNum}° Sem.${refTxt} (Folio: ${data.folio || '—'}).`);
            showAlert(`✓ Pago del ${semesterNum}° Semestre registrado.`, 'success');
            clearComprobanteFields();
            await loadTurnoResumen();
            await loadStudentFromServer(controlId);
        } else {
            showAlert(`✗ ${data.error || 'Error al registrar el pago.'}`, 'danger');
        }
    } catch (error) {
        console.error(error);
        showAlert('✗ Error de conexión al servidor.', 'danger');
    }
}

async function modificarPagoBackend(controlId, semesterNum, estadoPago) {
    if (estadoPago === true) {
        const tipo = tipoReferenciaSelect?.value;
        const ref = referenciaInput?.value?.trim();
        if (!tipo || !ref) {
            showAlert('✗ Para validar pago indique tipo y referencia del comprobante.', 'danger');
            return;
        }
    }

    const body = { control: controlId, semestre: semesterNum, estadoPago };
    if (estadoPago === true) {
        body.tipoReferencia = tipoReferenciaSelect.value;
        body.referencia = referenciaInput.value.trim();
    }

    try {
        const response = await fetch('/api/modificar-pago', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));

        if (response.ok) {
            const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            appendActivityLog(`[${hora}] ID: ${controlId} - Pago revertido para ${semesterNum}° Semestre.`, true);
            showAlert(`✓ Estatus revertido para el ${semesterNum}° Semestre.`, 'success');
            await loadTurnoResumen();
            await loadStudentFromServer(controlId);
        } else {
            showAlert(`✗ ${data.error || 'No se pudo modificar el registro.'}`, 'danger');
        }
    } catch (error) {
        console.error(error);
        showAlert('✗ Error de comunicación con el servidor.', 'danger');
    }
}

function showAlert(msg, type) {
    alertBanner.textContent = msg;
    alertBanner.className = `alert-banner alert-banner--${type}`;
    setTimeout(() => { alertBanner.className = 'alert-banner alert-banner--hidden'; }, 3500);
}

function setComprobanteEnabled(enabled) {
    if (tipoReferenciaSelect) tipoReferenciaSelect.disabled = !enabled;
    if (referenciaInput) referenciaInput.disabled = !enabled;
}

function clearComprobanteFields() {
    if (tipoReferenciaSelect) tipoReferenciaSelect.value = '';
    if (referenciaInput) referenciaInput.value = '';
}
