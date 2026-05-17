/*         LÓGICA FRONTEND OPTIMIZADA - CONSULTA DE ADEUDOS Y CAJA
   ========================================================================== */

// Base de datos de prueba con el historial de semestres adeudados
const baseAlumnosSimulada = {
    "23325050510528": {
        nombre: "Monserrat", paterno: "Rodríguez", materno: "Pérez", carrera: "electronica",
        historial: [
            { sem: "1", status: "PAGADO" },
            { sem: "2", status: "ADEUDO" },
            { sem: "3", status: "ADEUDO" }
        ]
    },
    "23325050510688": {
        nombre: "Paulina", paterno: "García", materno: "López", carrera: "informatica",
        historial: [
            { sem: "1", status: "PAGADO" },
            { sem: "2", status: "PAGADO" },
            { sem: "3", status: "PAGADO" },
            { sem: "4", status: "ADEUDO" }
        ]
    }
};

// Selectores del DOM
const idControlInput = document.getElementById('idControl');
const formRegistration = document.getElementById('registrationForm');
const alertBanner = document.getElementById('alertBanner');
const debtsTableBody = document.getElementById('debtsTableBody');
const semestreSelect = document.getElementById('semestre');
const btnSubmit = document.getElementById('btnSubmit');

const countSuccessEl = document.getElementById('countSuccess');
const countTotalEl = document.getElementById('countTotal');
const activityLog = document.getElementById('activityLog');

let validadosHoy = 0; let totalOperacionesHoy = 0;

/*               DETECTAR ENTRADA Y MOSTRAR ADEUDOS EN TABLA
   ========================================================================== */
idControlInput.addEventListener('input', (e) => {
    const idIntroducido = e.target.value.trim();
    
    if (baseAlumnosSimulada[idIntroducido]) {
        const alumno = baseAlumnosSimulada[idIntroducido];
        
        // Rellenar campos de texto fijos
        document.getElementById('nombre').value = alumno.nombre;
        document.getElementById('apellido_paterno').value = alumno.paterno;
        document.getElementById('apellido_materno').value = alumno.materno;
        document.getElementById('carrera').value = alumno.carrera;
        
        // Mostrar la lista de deudas y agregar opciones al menú desplegable de pagos.
        renderDebtsAndSelect(alumno.historial);
        showAlert('Historial financiero cargado correctamente.', 'warning');
    } else {
        resetFormularyState();
    }
});

function renderDebtsAndSelect(historial) {
    debtsTableBody.innerHTML = '';
    semestreSelect.innerHTML = '<option value="">Seleccione...</option>';
    let tieneAdeudos = false;

    historial.forEach(item => {
        // 1. Agregar fila a la tabla visual
        const tr = document.createElement('tr');
        const badgeClass = item.status === 'PAGADO' ? 'status-badge--success' : 'status-badge--danger';
        tr.innerHTML = `
            <td class="debts-table__td">${item.sem}° Semestre</td>
            <td class="debts-table__td"><span class="status-badge ${badgeClass}">${item.status}</span></td>
        `;
        debtsTableBody.appendChild(tr);

        // 2. Agregar al selector únicamente si es un adeudo
        if (item.status === 'ADEUDO') {
            tieneAdeudos = true;
            const opt = document.createElement('option');
            opt.value = item.sem;
            opt.textContent = `${item.sem}° Semestre`;
            semestreSelect.appendChild(opt);
        }
    });

    // Activar controles de cobro si el alumno presenta adeudos reales
    if (tieneAdeudos) {
        semestreSelect.disabled = false;
        btnSubmit.disabled = false;
    } else {
        semestreSelect.innerHTML = '<option value="">Sin adeudos</option>';
        semestreSelect.disabled = true;
        btnSubmit.disabled = true;
    }
}

/*            REGISTRO DEL PAGO DEL SEMESTRE SELECCIONADO
   ========================================================================== */
formRegistration.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = idControlInput.value.trim();
    const semAPagar = semestreSelect.value;

    if (baseAlumnosSimulada[id] && semAPagar) {
        const alumno = baseAlumnosSimulada[id];
        
        // Simular el cambio de estatus en memoria local para refrescar la interfaz
        const registroSemestre = alumno.historial.find(h => h.sem === semAPagar);
        if (registroSemestre) registroSemestre.status = 'PAGADO';

        // Actualizar contadores del panel administrativo izquierdo
        validadosHoy++; totalOperacionesHoy++;
        countSuccessEl.textContent = validadosHoy;
        countTotalEl.textContent = totalOperacionesHoy;
        
        // Escribir en la bitácora de actividad reciente
        const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const log = document.createElement('div');
        log.className = 'activity-log__item';
        log.innerHTML = `<span class="activity-log__time">[${hora}]</span> ID: ${id} - Recibido pago de ${semAPagar}° Semestre.`;
        activityLog.insertBefore(log, activityLog.firstChild);

        showAlert(`Pago del ${semAPagar}° Semestre procesado con éxito.`, 'success');
        
        // Refrescar inmediatamente la tabla y el selector del alumno actual
        renderDebtsAndSelect(alumno.historial);
    }
});

function resetFormularyState() {
    document.getElementById('nombre').value = '';
    document.getElementById('apellido_paterno').value = '';
    document.getElementById('apellido_materno').value = '';
    document.getElementById('carrera').value = '';
    debtsTableBody.innerHTML = `<tr><td class="debts-table__td" colspan="2" style="color: var(--color-muted); text-align: center;">Ingrese un ID para consultar adeudos</td></tr>`;
    semestreSelect.innerHTML = '<option value="">Seleccione...</option>';
    semestreSelect.disabled = true;
    btnSubmit.disabled = true;
}

function showAlert(msg, type) {
    alertBanner.textContent = msg;
    alertBanner.className = `alert-banner alert-banner--${type}`;
    setTimeout(() => { alertBanner.className = 'alert-banner alert-banner--hidden'; }, 3500);
}
