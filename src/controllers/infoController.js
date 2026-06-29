const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Student = require('../models/Student');
const PaymentTransaction = require('../models/PaymentTransaction');
const syncService = require('../services/syncService');
const { getCurrentAcademicPeriod, computeCurrentSemesterForStudent } = require('../utils/academic');
const { formatStudentForApi, getApellidosDisplay } = require('../utils/studentHelper');



// UBICACIÓN: src/controllers/infoController.js (o similar)
const excelService = require('../services/excelService'); 

exports.obtenerCarrerasUnicas = async (req, res) => {
    try {
        // 1. Leemos todos los alumnos desde el archivo maestro Excel utilizando tu servicio
        const alumnos = excelService.readAlumnosFromExcel();
        
        if (!alumnos || alumnos.length === 0) {
            return res.json({ success: true, carreras: [] });
        }

        // 2. Extraemos el campo 'carrera', limpiamos espacios y descartamos vacíos
        const mapeoCarreras = alumnos.map(alumno => {
            return alumno.carrera ? alumno.carrera.trim().toUpperCase() : '';
        });

        // 3. Usamos un Set para eliminar automáticamente los duplicados
        const carrerasUnicas = [...new Set(mapeoCarreras)]
            .filter(carrera => carrera !== '') // Quitamos filas en blanco
            .sort(); // Las ordenamos de la A a la Z

        // 4. Respondemos al Frontend
        return res.json({ success: true, carreras: carrerasUnicas });

    } catch (error) {
        console.error('❌ Error al procesar carreras únicas de Excel:', error);
        return res.status(500).json({ error: 'Error interno al procesar el archivo Excel' });
    }
};



function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildListQuery({ carrera, turno, grupo }) {
    const query = { activo: { $ne: false } };
    if (carrera) query.carrera = new RegExp(escapeRegex(carrera), 'i');
    if (turno) query.turno = new RegExp(escapeRegex(turno), 'i');
    if (grupo) query.grupo = new RegExp(`^${escapeRegex(grupo)}$`, 'i');
    return query;
}

function mapStudentToListItem(student, selectedSem) {
    const semestre = selectedSem || student.semestre_actual || computeCurrentSemesterForStudent(student.control);
    const semKey = `semestre_${semestre}`;
    return {
        control: student.control,
        nombre: student.nombre,
        apellidos: getApellidosDisplay(student),
        carrera: student.carrera,
        turno: student.turno,
        grupo: student.grupo || 'A',
        currentSemestre: computeCurrentSemesterForStudent(student.control),
        semestre,
        pagado: student[semKey] === true,
    };
}

exports.health = async (req, res) => {
    const mongoOk = mongoose.connection.readyState === 1;
    res.status(mongoOk ? 200 : 503).json({
        ok: mongoOk,
        db: mongoOk ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
    });
};

exports.getCurrentPeriod = (req, res) => {
    res.json(getCurrentAcademicPeriod());
};

exports.getAlumnos = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
        const skip = (page - 1) * limit;

        let count = await Student.countDocuments({ activo: { $ne: false } });
        if (count === 0) {
            await syncService.importAlumnosFromExcel();
            count = await Student.countDocuments({ activo: { $ne: false } });
        }

        const data = await Student.find({ activo: { $ne: false } })
            .sort({ control: 1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.json({
            total: count,
            page,
            limit,
            data: data.map(formatStudentForApi),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno' });
    }
};

exports.searchAlumnos = async (req, res) => {
    try {
        const q = String(req.query.q || '').replace(/\D/g, '');
        const limit = Math.min(parseInt(req.query.limit, 10) || 6, 20);
        if (!q) return res.json({ data: [] });

        const data = await Student.find({ control: new RegExp(`^${escapeRegex(q)}`) })
            .sort({ control: 1 })
            .limit(limit)
            .lean();

        res.json({ data: data.map(formatStudentForApi) });
    } catch (err) {
        res.status(500).json({ error: 'Error en búsqueda' });
    }
};

exports.getRegistros = async (req, res) => {
    try {
        let students = await Student.find({ activo: { $ne: false } }).lean();
        if (!students.length) {
            await syncService.importAlumnosFromExcel();
            students = await Student.find({ activo: { $ne: false } }).lean();
        }
        const data = students.map(formatStudentForApi);
        res.json({ total: data.length, data });
    } catch (err) {
        res.status(500).json({ error: 'Error interno' });
    }
};

exports.getListasFiltered = async (req, res) => {
    try {
        const carreraFilter = req.query.carrera ? String(req.query.carrera) : null;
        const semestreFilter = req.query.semestre ? parseInt(req.query.semestre, 10) : null;
        const turnoFilter = req.query.turno ? String(req.query.turno) : null;
        const grupoFilter = req.query.grupo ? String(req.query.grupo) : null;
        const pagadoFilter = req.query.pagado ? String(req.query.pagado).toLowerCase() : 'paid';

        let students = await Student.find(buildListQuery({
            carrera: carreraFilter,
            turno: turnoFilter,
            grupo: grupoFilter,
        })).lean();

        if (!students.length) {
            await syncService.importAlumnosFromExcel();
            students = await Student.find(buildListQuery({
                carrera: carreraFilter,
                turno: turnoFilter,
                grupo: grupoFilter,
            })).lean();
        }

        let list = students.map(s => mapStudentToListItem(s, semestreFilter));

        if (semestreFilter) {
            list = list.filter(item => item.semestre === semestreFilter);
        }

        if (pagadoFilter === 'paid') list = list.filter(item => item.pagado);
        else if (pagadoFilter === 'unpaid') list = list.filter(item => !item.pagado);

        const totalCandidatos = students.length;
        const excluidos = pagadoFilter === 'paid'
            ? totalCandidatos - list.length
            : 0;

        res.json({
            period: getCurrentAcademicPeriod(),
            total: list.length,
            excluidos,
            data: list,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno' });
    }
};

exports.getGroups = async (req, res) => {
    try {
        const carreraFilter = req.query.carrera ? String(req.query.carrera) : null;
        const semestreFilter = req.query.semestre ? parseInt(req.query.semestre, 10) : null;
        const turnoFilter = req.query.turno ? String(req.query.turno) : null;

        const students = await Student.find(buildListQuery({
            carrera: carreraFilter,
            turno: turnoFilter,
        })).lean();

        const groups = new Set();
        students.forEach(a => {
            const sem = semestreFilter || a.semestre_actual || computeCurrentSemesterForStudent(a.control);
            if (semestreFilter && sem !== semestreFilter) return;
            if (a.grupo) groups.add(a.grupo);
        });

        res.json({ groups: Array.from(groups).sort() });
    } catch (err) {
        res.status(500).json({ error: 'Error interno' });
    }
};

exports.getAudits = (req, res) => {
    try {
        const auditFile = path.join(__dirname, '..', '..', 'logs', 'audit.log');
        if (!fs.existsSync(auditFile)) return res.json({ audits: [] });
        const content = fs.readFileSync(auditFile, 'utf-8').trim();
        if (!content) return res.json({ audits: [] });
        const lines = content.split(/\r?\n/).filter(Boolean);
        const limit = req.query.limit ? Math.min(500, parseInt(req.query.limit, 10)) : 200;
        const last = lines.slice(-limit).map(l => JSON.parse(l));
        res.json({ total: lines.length, returned: last.length, audits: last });
    } catch (err) {
        res.status(500).json({ error: 'Error interno' });
    }
};

exports.syncFromExcel = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    try {
        const result = await syncService.importAlumnosFromExcel();
        await syncService.exportPagosToExcel();
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: 'Error al sincronizar desde Excel' });
    }
};

exports.exportToExcel = async (req, res) => {
    try {
        const ok = await syncService.exportPagosToExcel();
        if (!ok) return res.status(500).json({ error: 'No se pudo exportar' });
        res.json({ success: true, message: 'registros_pagos.xlsx actualizado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al exportar' });
    }
};
