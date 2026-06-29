function splitApellidos(apellidos) {
    const parts = String(apellidos || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { apellido_paterno: '', apellido_materno: '' };
    if (parts.length === 1) return { apellido_paterno: parts[0], apellido_materno: '' };
    return { apellido_paterno: parts[0], apellido_materno: parts.slice(1).join(' ') };
}

function getApellidosDisplay(student) {
    if (!student) return '';
    const paterno = student.apellido_paterno || '';
    const materno = student.apellido_materno || '';
    const combined = `${paterno} ${materno}`.trim();
    if (combined) return combined;
    return String(student.apellidos || '').trim();
}

function formatStudentForApi(student) {
    const apellidos = getApellidosDisplay(student);
    const { apellido_paterno, apellido_materno } = student.apellido_paterno
        ? { apellido_paterno: student.apellido_paterno, apellido_materno: student.apellido_materno || '' }
        : splitApellidos(apellidos);

    return {
        control: student.control,
        nombre: student.nombre || '',
        apellidos,
        apellido_paterno,
        apellido_materno,
        carrera: student.carrera || '',
        turno: student.turno || '',
        grupo: student.grupo || 'A',
        semestre: student.semestre_actual || null,
        semestre_1: !!student.semestre_1,
        semestre_2: !!student.semestre_2,
        semestre_3: !!student.semestre_3,
        semestre_4: !!student.semestre_4,
        semestre_5: !!student.semestre_5,
        semestre_6: !!student.semestre_6,
    };
}

function applyApellidosToDoc(doc, { nombre, paterno, materno, apellidos }) {
    doc.nombre = String(nombre || doc.nombre || '').trim();
    if (paterno || materno) {
        doc.apellido_paterno = String(paterno || '').trim();
        doc.apellido_materno = String(materno || '').trim();
    } else if (apellidos) {
        const split = splitApellidos(apellidos);
        doc.apellido_paterno = split.apellido_paterno;
        doc.apellido_materno = split.apellido_materno;
    }
    doc.apellidos = getApellidosDisplay(doc);
}

function isValidControl(control) {
    return /^\d{14}$/.test(String(control || '').trim());
}

module.exports = {
    splitApellidos,
    getApellidosDisplay,
    formatStudentForApi,
    applyApellidosToDoc,
    isValidControl,
};
