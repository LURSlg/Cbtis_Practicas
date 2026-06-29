const Student = require('../models/Student');
const { getCurrentAcademicPeriod } = require('../utils/academic');
const { splitApellidos, formatStudentForApi } = require('../utils/studentHelper');
const excelService = require('./excelService');

async function ensureIndexes() {
    await Student.syncIndexes();
    const PaymentTransaction = require('../models/PaymentTransaction');
    await PaymentTransaction.syncIndexes();
}

async function importAlumnosFromExcel() {
    const alumnos = excelService.readAlumnosFromExcel();
    if (!alumnos.length) {
        console.log('ℹ️ [SYNC] Sin alumnos en Excel maestro para importar.');
        return { imported: 0, updated: 0 };
    }

    const registros = excelService.readRegistrosFromExcel();
    const registrosMap = new Map(registros.map(r => [r.control, r]));
    const ciclo = getCurrentAcademicPeriod().period;
    let imported = 0;
    let updated = 0;

    for (const row of alumnos) {
        if (!row.control) continue;

        const existing = await Student.findOne({ control: row.control });
        const registro = registrosMap.get(row.control);
        const apellidosSplit = splitApellidos(row.apellidos);

        const semestreNum = parseInt(row.semestre, 10);
        const baseData = {
            nombre: row.nombre || existing?.nombre || '',
            apellido_paterno: apellidosSplit.apellido_paterno || existing?.apellido_paterno || '',
            apellido_materno: apellidosSplit.apellido_materno || existing?.apellido_materno || '',
            apellidos: row.apellidos || existing?.apellidos || '',
            carrera: row.carrera || existing?.carrera || '',
            turno: row.turno || existing?.turno || 'MATUTINO',
            grupo: row.grupo || existing?.grupo || 'A',
            semestre_actual: Number.isFinite(semestreNum) ? semestreNum : existing?.semestre_actual,
            ciclo_escolar: ciclo,
            activo: true,
        };

        if (!existing) {
            const paymentFromRegistro = {};
            for (let i = 1; i <= 6; i++) {
                paymentFromRegistro[`semestre_${i}`] = registro ? !!registro[`semestre_${i}`] : false;
            }
            await Student.create({ control: row.control, ...baseData, ...paymentFromRegistro });
            imported++;
            continue;
        }

        Object.assign(existing, baseData);
        if (registro) {
            for (let i = 1; i <= 6; i++) {
                const key = `semestre_${i}`;
                if (registro[key] === true) existing[key] = true;
            }
        }
        await existing.save();
        updated++;
    }

    console.log(`✅ [SYNC] Excel → MongoDB: ${imported} nuevos, ${updated} actualizados.`);
    return { imported, updated };
}

async function exportPagosToExcel() {
    const students = await Student.find({ activo: { $ne: false } }).lean();
    const registros = students.map(s => formatStudentForApi(s));
    const ok = excelService.writeRegistrosToExcel(registros);
    if (ok) console.log(`📤 [SYNC] MongoDB → Excel: ${registros.length} registros exportados.`);
    return ok;
}

module.exports = {
    ensureIndexes,
    importAlumnosFromExcel,
    exportPagosToExcel,
};
