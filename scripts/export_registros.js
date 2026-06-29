const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const baseDir = path.join(__dirname, '..');
const inputFile = path.join(baseDir, 'dataBase', 'registros_pagos.xlsx');
const outputFile = path.join(baseDir, 'public', 'registros.json');

console.log('Leyendo Excel de registros:', inputFile);

if (!fs.existsSync(inputFile)) {
    console.error(`No se encontró archivo: ${inputFile}`);
    process.exit(1);
}

const workbook = XLSX.readFile(inputFile);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log(`Leyendo hoja: "${sheetName}"`);
console.log(`Total de registros: ${data.length}`);

const records = data.map(row => ({
    control: String(row.NO_CONTROL || '').trim(),
    nombre: String(row.NOMBRE || '').trim(),
    apellidos: String(row.APELLIDOS || '').trim(),
    carrera: String(row.CARRERA || '').trim(),
    turno: String(row.TURNO || '').trim(),
    semestre_1: row.semestre_1 === true || row.semestre_1 === 'TRUE' || row.semestre_1 === 1,
    semestre_2: row.semestre_2 === true || row.semestre_2 === 'TRUE' || row.semestre_2 === 1,
    semestre_3: row.semestre_3 === true || row.semestre_3 === 'TRUE' || row.semestre_3 === 1,
    semestre_4: row.semestre_4 === true || row.semestre_4 === 'TRUE' || row.semestre_4 === 1,
    semestre_5: row.semestre_5 === true || row.semestre_5 === 'TRUE' || row.semestre_5 === 1,
    semestre_6: row.semestre_6 === true || row.semestre_6 === 'TRUE' || row.semestre_6 === 1,
}));

fs.writeFileSync(outputFile, JSON.stringify(records, null, 2), 'utf-8');

console.log(`JSON exportado: ${outputFile}`);
console.log(`Estructura: control, nombre, apellidos, carrera, turno, semestre_1..6 (boolean)`);
