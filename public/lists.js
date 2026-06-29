// ==========================================================================
// ESTADO GLOBAL Y CONFIGURACIÓN DE COLUMNAS
// ==========================================================================
const tableState = {
    rows: [],
    sortKey: 'control',
    sortDirection: 'asc',
    hiddenColumns: new Set(),
};

const columns = [
    { key: 'control', label: 'Número de Control', value: item => item.control || '' },
    { key: 'nombre', label: 'Nombre', value: item => `${item.nombre || ''} ${item.apellidos || ''}`.trim() },
    { key: 'grupo', label: 'Grupo', value: item => item.grupo || '-' },
    { key: 'carrera', label: 'Especialidad', value: item => item.carrera || '-' },
    { key: 'turno', label: 'Turno', value: item => item.turno || '-' },
    { key: 'semestre', label: 'Semestre', value: item => item.semestre || '-' },
    { key: 'inscripcion', label: 'Inscripción', value: item => item.pagado ? 'Pagada' : 'Pendiente' },
];

const gruposPropedeutico = ["A", "B", "C", "D"];

// ==========================================================================
// MÉTODOS DE CONSUMO DE API (FETCH)
// ==========================================================================
async function fetchAlumnos() {
    const res = await fetch('/api/alumnos', { cache: 'no-store' });
    const payload = await res.json();
    return payload.data || [];
}

async function fetchLists(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch('/api/listas' + (qs ? ('?' + qs) : ''), { cache: 'no-store' });
    return res.json();
}

// ==========================================================================
// UTILIDADES
// ==========================================================================
function el(id) { return document.getElementById(id); }

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getVisibleColumns() {
    return columns.filter(column => !tableState.hiddenColumns.has(column.key));
}

function getSortValue(item, key) {
    const column = columns.find(col => col.key === key);
    if (!column) return '';
    return String(column.value(item)).toLowerCase();
}

function getSortedRows() {
    const rows = [...tableState.rows];
    const direction = tableState.sortDirection === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
        const aValue = getSortValue(a, tableState.sortKey);
        const bValue = getSortValue(b, tableState.sortKey);
        return aValue.localeCompare(bValue, 'es', { numeric: true, sensitivity: 'base' }) * direction;
    });
    return rows;
}

// ==========================================================================
// RENDERIZADO DE FILTROS DINÁMICOS
// ==========================================================================
async function populateCarreras() {
    const alumnos = await fetchAlumnos();
    const set = new Set(alumnos.map(a => a.carrera).filter(Boolean));
    if (el('carreraFilter')) {
        el('carreraFilter').innerHTML = '<option value="">Todas</option>' + Array.from(set).sort().map(c => `<option value="${c}">${c}</option>`).join('');
    }
    const turnos = new Set(alumnos.map(a => a.turno).filter(Boolean));
    if (el('turnoFilter')) {
        el('turnoFilter').innerHTML = '<option value="">Todos</option>' + Array.from(turnos).sort().map(t => `<option value="${t}">${t}</option>`).join('');
    }
    initGrupoFilterBehavior();
}

function initGrupoFilterBehavior() {
    const semestreFilter = el('semestreFilter');
    const grupoFilter = el('grupoFilter');
    const grupoFilterContainer = el('grupoFilterContainer');

    if (!semestreFilter || !grupoFilter) return;

    semestreFilter.addEventListener('change', () => {
        const sem = semestreFilter.value;
        grupoFilter.innerHTML = '';

        if (sem === "1") {
            if (grupoFilterContainer) grupoFilterContainer.style.opacity = "1";
            grupoFilter.disabled = false;
            grupoFilter.innerHTML = '<option value="">Todos</option>' + 
                gruposPropedeutico.map(g => `<option value="${g}">${g}</option>`).join('');
        } else if (sem !== "") {
            if (grupoFilterContainer) grupoFilterContainer.style.opacity = "0.6";
            grupoFilter.innerHTML = '<option value="A">A (Especialidad)</option>';
            grupoFilter.value = "A";
        } else {
            if (grupoFilterContainer) grupoFilterContainer.style.opacity = "1";
            grupoFilter.disabled = false;
            grupoFilter.innerHTML = '<option value="">Todos</option>';
        }
        applyFilters();
    });
}

// ==========================================================================
// CONFIGURACIÓN Y PERSISTENCIA DE ARANCELES (CORREGIDO PARA MONGO)
// ==========================================================================
function initCostsConfiguration() {
    const costsModal = el('costsModal');
    const btnOpenCosts = el('btnOpenCosts');
    const costsForm = el('costsForm');

    if (!costsModal || !costsForm) return;

    // Modificado: Ahora consulta la ruta real de tu paymentController que jala de Mongo
    fetch('/api/costs')
        .then(res => res.json())
        .then(data => {
            // Evaluamos si el backend responde con un objeto directo o anidado
            if (data) {
                // Buscamos el valor arancelario guardado en base de datos. Si no existe, ponemos 2000 por defecto.
                const costoVigente = data.costoPorSemestre || data.costo || 2000;
                
                // Rellenamos los 6 campos para que el usuario vea el costo real actual al abrir el modal
                if (el('costSem1')) el('costSem1').value = costoVigente;
                if (el('costSem2')) el('costSem2').value = costoVigente;
                if (el('costSem3')) el('costSem3').value = costoVigente;
                if (el('costSem4')) el('costSem4').value = costoVigente;
                if (el('costSem5')) el('costSem5').value = costoVigente;
                if (el('costSem6')) el('costSem6').value = costoVigente;
            }
        }).catch(err => console.warn('Aviso: No se pudieron precargar los costos persistentes de MongoDB.', err));

    btnOpenCosts?.addEventListener('click', () => {
        costsModal.classList.remove('hidden');
    });

    ['costsModalClose', 'costsModalBackdrop'].forEach(id => {
        el(id)?.addEventListener('click', () => costsModal.classList.add('hidden'));
    });

    costsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Enviamos el costo del primer input como el nuevo arancel general del sistema
        const nuevoCosto = parseFloat(el('costSem1').value || 0);
        const payload = { costo: nuevoCosto };

        try {
            const response = await fetch('/api/costs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                costsModal.classList.add('hidden');
                // Forzamos recarga silenciosa de la tabla de alumnos para refrescar los cálculos
                applyFilters(); 
            }
        } catch (err) {
            console.error('Error silencioso al guardar aranceles:', err);
        }
    });
}

// ==========================================================================
// EXPEDIENTE DE PAGO INDIVIDUAL (MODAL HISTORIAL)
// ==========================================================================
async function openStudentHistory(controlNumber) {
    const modal = el('historyModal');
    const tableBody = el('historyTableBody');
    if (!modal || !tableBody) return;

    el('historyStudentMeta').textContent = `Cargando expediente...`;
    el('historyStudentName').textContent = `Consultando movimientos del folio...`;
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--color-muted);">Sincronizando con el servidor...</td></tr>';
    
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`/api/students/${controlNumber}/payments`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error al obtener transacciones.');

        el('historyStudentMeta').textContent = `Control: ${data.student.noControl} • Grupo: ${data.student.grupo || 'A'} • ${data.student.turno || ''}`;
        el('historyStudentName').textContent = data.student.name;

        el('histStatTotal').textContent = `$${data.summary.totalCharged.toFixed(2)}`;
        el('histStatPaid').textContent  = `$${data.summary.totalPaid.toFixed(2)}`;
        el('histStatDebt').textContent  = `$${data.summary.totalDebt.toFixed(2)}`;

        tableBody.innerHTML = '';
        data.history.forEach(row => {
            const tr = document.createElement('tr');
            const stateLabel = row.deuda <= 0 
                ? '<span style="color:#81c784; font-weight:bold;">✓ Liquidado</span>' 
                : `<span style="color:#e57373;">Restan $${row.deuda.toFixed(2)}</span>`;
            
            tr.innerHTML = `
                <td class="debts-table__td"><b>${row.periodo}° Semestre</b> (Inscripción)</td>
                <td class="debts-table__td">${row.fecha || '—'}</td>
                <td class="debts-table__td"><code>${row.folio || '—'}</code></td>
                <td class="debts-table__td">$${row.costoBase.toFixed(2)}</td>
                <td class="debts-table__td">$${row.abonado.toFixed(2)}</td>
                <td class="debts-table__td">${stateLabel}</td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="6" style="color:#e57373; text-align:center;">${err.message}</td></tr>`;
    }
}

// ==========================================================================
// CONTROL DE RENDERIZADO DE TABLA E INTERFAZ
// ==========================================================================
function renderColumnControls() {
    const controls = el('columnControls');
    if (!controls) return;

    controls.innerHTML = columns.map(column => `
        <label class="column-toggle" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
            <input type="checkbox" value="${column.key}" ${tableState.hiddenColumns.has(column.key) ? '' : 'checked'}>
            <span>${column.label}</span>
        </label>
    `).join('');

    controls.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => {
            const visibleCount = getVisibleColumns().length;
            if (!input.checked && visibleCount === 1) {
                input.checked = true;
                return;
            }

            if (input.checked) {
                tableState.hiddenColumns.delete(input.value);
            } else {
                tableState.hiddenColumns.add(input.value);
            }
            renderTable();
        });
    });
}

function renderTableHeader() {
    const header = el('listsTableHead');
    if (!header) return;

    header.innerHTML = getVisibleColumns().map(column => {
        const isActive = tableState.sortKey === column.key;
        const indicator = isActive ? (tableState.sortDirection === 'asc' ? '↑' : '↓') : '↕';
        return `
            <th data-column="${column.key}">
                <button type="button" class="table-sort" data-sort="${column.key}" aria-label="Ordenar por ${column.label}">
                    <span>${column.label}</span>
                    <span class="table-sort__indicator">${indicator}</span>
                </button>
            </th>
        `;
    }).join('') + `<th>Acciones</th>`;

    header.querySelectorAll('[data-sort]').forEach(button => {
        button.addEventListener('click', () => {
            const key = button.getAttribute('data-sort');
            if (tableState.sortKey === key) {
                tableState.sortDirection = tableState.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                tableState.sortKey = key;
                tableState.sortDirection = 'asc';
            }
            renderTable();
        });
    });
}

function renderTable(list = tableState.rows) {
    tableState.rows = list;
    renderTableHeader();

    const body = el('listsTableBody');
    const visibleColumns = getVisibleColumns();
    if (!body) return;
    body.innerHTML = '';

    if (!tableState.rows.length) {
        body.innerHTML = `<tr><td colspan="${visibleColumns.length + 1}" class="debts-table__td table-empty">No se encontraron registros financieros</td></tr>`;
        return;
    }

    getSortedRows().forEach(item => {
        const tr = document.createElement('tr');
        
        let htmlCells = visibleColumns.map(column => `
            <td class="debts-table__td" data-column="${column.key}">${escapeHtml(column.value(item))}</td>
        `).join('');

        const targetControl = item.control || '';
        htmlCells += `
            <td class="debts-table__td">
                <button type="button" class="list-action-btn" style="background:#333; border:1px solid #555; padding:3px 10px; font-size:0.75rem; border-radius:4px;" onclick="openStudentHistory('${targetControl}')">
                    📂 Historial
                </button>
            </td>
        `;

        tr.innerHTML = htmlCells;
        body.appendChild(tr);
    });
}

// ==========================================================================
// FILTRADO Y ACCIONES COMPLEMENTARIAS
// ==========================================================================
async function applyFilters() {
    const carrera = el('carreraFilter').value;
    const semestre = el('semestreFilter').value;
    const turno = el('turnoFilter').value;
    const grupo = el('grupoFilter')?.value || '';
    const pagado = el('pagadoFilter').value || 'paid';

    const params = {};
    if (carrera) params.carrera = carrera;
    if (semestre) params.semestre = semestre;
    if (turno) params.turno = turno;
    if (grupo) params.grupo = grupo;
    if (pagado) params.pagado = pagado;

    const payload = await fetchLists(params);
    renderTable(payload.data || []);
    updateListActions(payload.data || [], payload.excluidos);
}

function updateListActions(list, excluidos = 0) {
    const listActions = el('listActions');
    const filterHint = el('filterHint');
    if (!listActions || !filterHint) return;

    if (!list.length) {
        listActions.classList.add('hidden');
        filterHint.classList.remove('hidden');
        filterHint.textContent = excluidos > 0
            ? `Ningún alumno solvente en este filtro (${excluidos} excluidos por adeudo).`
            : 'Ajuste los filtros para obtener un grupo homogéneo.';
        return;
    }

    const carreras = new Set(list.map(item => String(item.carrera || '').trim()));
    const turnos = new Set(list.map(item => String(item.turno || '').trim()));
    const semestres = new Set(list.map(item => String(item.semestre || '').trim()));
    const grupos = new Set(list.map(item => String(item.grupo || '').trim()));
    
    const allPaid = list.every(item => item.pagado === true);
    const hasCompleteGroupData = [...carreras][0] && [...turnos][0] && [...semestres][0];
    const isSingleGroup = carreras.size === 1 && turnos.size === 1 && semestres.size === 1 && grupos.size === 1;

    if (allPaid && hasCompleteGroupData && isSingleGroup) {
        listActions.classList.remove('hidden');
        filterHint.classList.add('hidden');
        
        const first = list[0];
        const excluidosMsg = excluidos > 0 ? ` · ${excluidos} excluidos por adeudo` : '';
        if (el('listActionsLabel')) {
            el('listActionsLabel').textContent = `Lista lista para exportar — Semestre ${first.semestre}° Grupo ${first.grupo || 'A'} (${first.turno})${excluidosMsg}`;
        }
    } else {
        listActions.classList.add('hidden');
        filterHint.classList.remove('hidden');
    }
}

// ==========================================================================
// ESCUCHA DE CARGA INICIAL Y VINCULACIÓN DOM
// ==========================================================================
window.addEventListener('load', async () => {
    if (window.waitForAuth) {
        try {
            await window.waitForAuth();
        } catch (error) {
            console.error('Auth check error:', error);
            return;
        }
    }
    
    if (window.authSession && !window.authSession.loggedIn) {
        return;
    }

    // Inicializaciones modulares y columnas
    renderColumnControls();
    initCostsConfiguration();
    await populateCarreras();

    // Eventos del nuevo modal adaptativo de columnas visibles
    const columnsModal = el('columnsModal');
    el('btnOpenColumns')?.addEventListener('click', () => columnsModal.classList.remove('hidden'));
    ['columnsModalClose', 'columnsModalBackdrop'].forEach(id => {
        el(id)?.addEventListener('click', () => columnsModal.classList.add('hidden'));
    });
    
    // Asignación de filtros de cambio
    ['carreraFilter', 'semestreFilter', 'turnoFilter', 'pagadoFilter', 'grupoFilter'].forEach(id => {
        const elRef = el(id);
        if (elRef) elRef.addEventListener('change', applyFilters);
    });

    // Control unificado para cierres de modales (Historial y Gmail)
    ['historyModalClose', 'historyModalBackdrop'].forEach(id => {
        el(id)?.addEventListener('click', () => el('historyModal').classList.add('hidden'));
    });
    ['gmailModalClose', 'gmailModalBackdrop'].forEach(id => {
        el(id)?.addEventListener('click', () => el('gmailModal').classList.add('hidden'));
    });

    // Descarga de plantillas de asistencia en Word (.docx)
    const btnDownloadWord = el('btnDownloadWord');
    if (btnDownloadWord) {
        btnDownloadWord.addEventListener('click', async () => {
            if (!tableState.rows.length) return;

            const firstItem = tableState.rows[0];
            const payload = {
                especialidad: firstItem.carrera,
                semestre: firstItem.semestre,
                turno: firstItem.turno,
                grupo: firstItem.grupo || 'A',
            };

            try {
                const res = await fetch('/api/generar-lista-word', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || 'Error al generar el Word en servidor');
                }

                const excluidos = res.headers.get('X-Excluidos-Adeudo');
                if (excluidos && parseInt(excluidos, 10) > 0) {
                    console.info(`${excluidos} alumnos excluidos por adeudo (validado en servidor).`);
                }

                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Lista_${payload.semestre}_${payload.grupo || 'A'}_${payload.turno}.docx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (err) {
                console.error(err);
                alert(err.message || 'No se pudo generar la lista.');
            }
        });
    }

    // Modal de envío rápido usando protocolo mailto
    const btnSendGmail = el('btnSendGmail');
    const gmailModal = el('gmailModal');
    const gmailSend = el('gmailSend');

    if (btnSendGmail && gmailModal) {
        btnSendGmail.addEventListener('click', () => {
            gmailModal.classList.remove('hidden');
            const firstItem = tableState.rows[0];
            if (firstItem) {
                el('gmailSubject').value = `Lista de asistencia — Semestre ${firstItem.semestre}° Grupo ${firstItem.grupo || 'A'}`;
            }
        });
    }

    if (gmailSend) {
        gmailSend.addEventListener('click', () => {
            const to = el('gmailTo').value;
            const subject = encodeURIComponent(el('gmailSubject').value);
            const body = encodeURIComponent(el('gmailBody').value);

            if (!to) {
                el('gmailError').innerText = 'Por favor, introduce un destinatario válido.';
                return;
            }
            
            el('gmailError').innerText = '';
            window.open(`mailto:${to}?subject=${subject}&body=${body}`, '_blank');
            gmailModal.classList.add('hidden');
        });
    }

    // Primera consulta limpia (Inscripciones pagadas por defecto)
    const initial = await fetchLists({ pagado: 'paid' });
    renderTable(initial.data || []);
    updateListActions(initial.data || [], initial.excluidos);
});

window.addEventListener('auth:login', async () => {
    if (window.authSession && !window.authSession.loggedIn) return;
    await populateCarreras();
    await applyFilters();
});

window.openStudentHistory = openStudentHistory;