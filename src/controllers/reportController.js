const path = require('path');
const fs = require('fs');
const Student = require('../models/Student');
const syncService = require('../services/syncService');
const excelService = require('../services/excelService');
const { getCurrentAcademicPeriod, computeCurrentSemesterForStudent } = require('../utils/academic');
const { getApellidosDisplay } = require('../utils/studentHelper');

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function queryPaidStudents({ carrera, semestre, turno, grupo }) {
    const sem = parseInt(semestre, 10);
    if (!carrera || !sem || !turno) {
        throw new Error('Filtros incompletos: carrera, semestre y turno son obligatorios');
    }

    const semKey = `semestre_${sem}`;
    const query = {
        activo: { $ne: false },
        [semKey]: true,
        carrera: new RegExp(escapeRegex(carrera), 'i'),
        turno: new RegExp(escapeRegex(turno), 'i'),
    };
    if (grupo) query.grupo = new RegExp(`^${escapeRegex(grupo)}$`, 'i');

    const alumnos = await Student.find(query)
        .sort({ apellido_paterno: 1, apellido_materno: 1, nombre: 1 })
        .lean();

    const totalQuery = {
        activo: { $ne: false },
        carrera: query.carrera,
        turno: query.turno,
    };
    if (grupo) totalQuery.grupo = query.grupo;
    const totalGrupo = await Student.countDocuments(totalQuery);
    const excluidos = Math.max(totalGrupo - alumnos.length, 0);

    return { alumnos, excluidos, sem };
}

exports.generarListaWord = async (req, res) => {
    const { especialidad, carrera, semestre, turno, grupo } = req.body;

    try {
        const { alumnos, excluidos, sem } = await queryPaidStudents({
            carrera: especialidad || carrera,
            semestre,
            turno,
            grupo: grupo || undefined,
        });

        if (!alumnos.length) {
            return res.status(404).json({
                error: 'No hay alumnos solventes con esos filtros',
                excluidos,
            });
        }

        const PizZip = require('pizzip');
        const Docxtemplater = require('docxtemplater');
        const templatePath = path.resolve(__dirname, '..', '..', 'plantillas', 'formato_asistencia.docx');
        const content = fs.readFileSync(templatePath, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

        doc.render({
            especialidad: especialidad || carrera,
            periodo: getCurrentAcademicPeriod().period,
            grupo: grupo || 'A',
            turno,
            alumnos: alumnos.map((a, index) => ({
                num: index + 1,
                control: a.control,
                nombre: `${getApellidosDisplay(a)} ${a.nombre}`.trim(),
            })),
        });

        const buf = doc.getZip().generate({ type: 'nodebuffer' });
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.set('Content-Disposition', `attachment; filename=Lista_${sem}_${grupo || 'A'}_${turno}.docx`);
        res.set('X-Excluidos-Adeudo', String(excluidos));
        res.send(buf);
    } catch (error) {
        console.error('Error generando Word:', error);
        res.status(error.message.includes('Filtros') ? 400 : 500).json({ error: error.message || 'Error generando el documento' });
    }
};

exports.exportListaExcel = async (req, res) => {
    const { carrera, semestre, turno, grupo } = req.query;

    try {
        const { alumnos, excluidos, sem } = await queryPaidStudents({
            carrera,
            semestre,
            turno,
            grupo: grupo || undefined,
        });

        if (!alumnos.length) {
            return res.status(404).json({ error: 'No hay alumnos solventes', excluidos });
        }

        const filename = `lista_${sem}_${grupo || 'A'}_${Date.now()}.xlsx`;
        const rows = alumnos.map(a => ({
            control: a.control,
            nombre: a.nombre,
            apellidos: getApellidosDisplay(a),
            carrera: a.carrera,
            turno: a.turno,
            grupo: a.grupo,
            semestre: sem,
        }));

        const filePath = excelService.writeListToExcel(rows, filename);
        if (!filePath) return res.status(500).json({ error: 'Error al generar Excel' });

        res.download(filePath, filename, () => {
            try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.uploadDatabase = async (req, res) => {
    if (!req.session.user || req.session.user.username !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    const tempPath = req.file.path;
    const masterPath = excelService.getMasterExcelPath() || path.join(excelService.DATA_BASE_DIR, 'DETALLE.xlsx');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivePath = path.join(excelService.DATA_BASE_DIR, `archive_${timestamp}.xlsx`);

    try {
        if (!fs.existsSync(excelService.DATA_BASE_DIR)) {
            fs.mkdirSync(excelService.DATA_BASE_DIR, { recursive: true });
        }
        if (fs.existsSync(masterPath)) {
            fs.renameSync(masterPath, archivePath);
        }
        fs.renameSync(tempPath, masterPath);

        const syncResult = await syncService.importAlumnosFromExcel();
        await syncService.exportPagosToExcel();

        res.json({
            success: true,
            message: 'Base de datos actualizada e importada a MongoDB.',
            sync: syncResult,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error archivando base de datos' });
    }
};
