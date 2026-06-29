const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DATA_BASE_DIR = path.join(__dirname, '..', '..', 'dataBase');

function getMasterExcelPath() {
    if (!fs.existsSync(DATA_BASE_DIR)) return null;
    const files = fs.readdirSync(DATA_BASE_DIR);
    const detalle = files.find(f => /^DETALLE/i.test(f) && f.endsWith('.xlsx'));
    if (detalle) return path.join(DATA_BASE_DIR, detalle);
    const other = files.find(f =>
        f.endsWith('.xlsx') &&
        !/^registros/i.test(f) &&
        !/^archive/i.test(f) &&
        !/^reporte/i.test(f)
    );
    return other ? path.join(DATA_BASE_DIR, other) : null;
}

function readAlumnosFromExcel() {
    try {
        const master = getMasterExcelPath();
        if (!master) {
            console.warn('⚠️ Archivo maestro Excel no encontrado en dataBase/');
            return [];
        }
        const wb = XLSX.readFile(master, { cellDates: true });
        const sheetName = wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
        return rows.map(r => ({
            control: String(r['NO CONTROL'] || r['NO_CONTROL'] || r.NO_CONTROL || r['No Control'] || '').trim(),
            nombre: String(r['NOMBRE'] || r.NOMBRE || '').trim(),
            apellidos: String(r['APELLIDOS'] || r.APELLIDOS || '').trim(),
            carrera: String(r['CARRERA'] || r.CARRERA || '').trim(),
            turno: String(r['TURNO'] || r.TURNO || '').trim(),
            semestre: String(r['SEMESTRE'] || r.SEMESTRE || '').trim(),
            grupo: String(r['GRUPO'] || r.GRUPO || '').trim(),
            correo: String(r['CORREO'] || r.CORREO || '').trim()
        })).filter(r => r.control);
    } catch (err) {
        console.error('Error leyendo alumnos desde Excel:', err);
        return [];
    }
}

function readRegistrosFromExcel() {
    try {
        const file = path.join(DATA_BASE_DIR, 'registros_pagos.xlsx');
        if (!fs.existsSync(file)) return [];
        const wb = XLSX.readFile(file, { cellDates: true });
        const sheetName = wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
        return rows.map(r => ({
            control: String(r['NO_CONTROL'] || r['NO CONTROL'] || r['No_Control'] || r.NO_CONTROL || '').trim(),
            nombre: String(r['NOMBRE'] || r.NOMBRE || '').trim(),
            apellidos: String(r['APELLIDOS'] || r.APELLIDOS || '').trim(),
            carrera: String(r['CARRERA'] || r.CARRERA || '').trim(),
            turno: String(r['TURNO'] || r.TURNO || '').trim(),
            grupo: String(r['GRUPO'] || r.GRUPO || '').trim(),
            semestre_1: !!r.semestre_1 || !!r['semestre_1'] || !!r['Semestre 1'] || Boolean(r.SEMESTRE_1),
            semestre_2: !!r.semestre_2 || !!r['semestre_2'] || !!r['Semestre 2'] || Boolean(r.SEMESTRE_2),
            semestre_3: !!r.semestre_3 || !!r['semestre_3'] || !!r['Semestre 3'] || Boolean(r.SEMESTRE_3),
            semestre_4: !!r.semestre_4 || !!r['semestre_4'] || !!r['Semestre 4'] || Boolean(r.SEMESTRE_4),
            semestre_5: !!r.semestre_5 || !!r['semestre_5'] || !!r['Semestre 5'] || Boolean(r.SEMESTRE_5),
            semestre_6: !!r.semestre_6 || !!r['semestre_6'] || !!r['Semestre 6'] || Boolean(r.SEMESTRE_6),
        }));
    } catch (err) {
        console.error('Error leyendo registros desde Excel:', err);
        return [];
    }
}

function writeRegistrosToExcel(registros) {
    try {
        const file = path.join(DATA_BASE_DIR, 'registros_pagos.xlsx');
        const rows = registros.map(r => ({
            NO_CONTROL: r.control,
            NOMBRE: r.nombre || '',
            APELLIDOS: r.apellidos || '',
            CARRERA: r.carrera || '',
            TURNO: r.turno || '',
            GRUPO: r.grupo || '',
            semestre_1: !!r.semestre_1,
            semestre_2: !!r.semestre_2,
            semestre_3: !!r.semestre_3,
            semestre_4: !!r.semestre_4,
            semestre_5: !!r.semestre_5,
            semestre_6: !!r.semestre_6,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        if (!fs.existsSync(DATA_BASE_DIR)) fs.mkdirSync(DATA_BASE_DIR, { recursive: true });
        XLSX.utils.book_append_sheet(wb, ws, 'registros');
        XLSX.writeFile(wb, file);
        return true;
    } catch (err) {
        console.error('Error escribiendo registros a Excel:', err);
        return false;
    }
}

function writeListToExcel(alumnos, filename) {
    try {
        if (!fs.existsSync(DATA_BASE_DIR)) fs.mkdirSync(DATA_BASE_DIR, { recursive: true });
        const file = path.join(DATA_BASE_DIR, filename);
        const rows = alumnos.map((a, index) => ({
            NUM: index + 1,
            NO_CONTROL: a.control,
            NOMBRE: a.nombre || '',
            APELLIDOS: a.apellidos || '',
            CARRERA: a.carrera || '',
            TURNO: a.turno || '',
            GRUPO: a.grupo || 'A',
            SEMESTRE: a.semestre || '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'lista');
        XLSX.writeFile(wb, file);
        return file;
    } catch (err) {
        console.error('Error escribiendo lista a Excel:', err);
        return null;
    }
}

module.exports = {
    readAlumnosFromExcel,
    readRegistrosFromExcel,
    writeRegistrosToExcel,
    writeListToExcel,
    getMasterExcelPath,
    DATA_BASE_DIR,
};
