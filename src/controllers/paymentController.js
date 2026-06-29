const Student = require('../models/Student');
const Cost = require('../models/Cost');
const PaymentTransaction = require('../models/PaymentTransaction');
const excelService = require('../services/excelService');
const syncService = require('../services/syncService');
const { appendAudit } = require('../utils/logger');
const {
    getApellidosDisplay,
    applyApellidosToDoc,
    isValidControl,
    splitApellidos,
} = require('../utils/studentHelper');

function generateFolio() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `CBTIS-${date}-${time}-${rand}`;
}

async function getCostoSemestre() {
    const config = await Cost.findOne({ concepto: 'general' });
    return config ? config.costoPorSemestre : 2000;
}

async function findOrCreateStudent(control, datosExtra = {}) {
    let alumno = await Student.findOne({ control });

    if (!alumno) {
        const alExcel = excelService.readAlumnosFromExcel().find(a => a.control === control);
        const regExcel = excelService.readRegistrosFromExcel().find(r => r.control === control);

        alumno = new Student({
            control,
            nombre: datosExtra.nombre || alExcel?.nombre || regExcel?.nombre || 'Estudiante',
            apellidos: datosExtra.apellidos || alExcel?.apellidos || regExcel?.apellidos || '',
            carrera: datosExtra.carrera || alExcel?.carrera || regExcel?.carrera || '',
            turno: datosExtra.turno || alExcel?.turno || regExcel?.turno || 'MATUTINO',
            grupo: datosExtra.grupo || alExcel?.grupo || regExcel?.grupo || 'A',
        });

        if (regExcel) {
            for (let i = 1; i <= 6; i++) {
                alumno[`semestre_${i}`] = !!regExcel[`semestre_${i}`];
            }
        }
    }

    applyApellidosToDoc(alumno, {
        nombre: datosExtra.nombre,
        paterno: datosExtra.paterno,
        materno: datosExtra.materno,
        apellidos: datosExtra.apellidos,
    });

    if (datosExtra.carrera) alumno.carrera = datosExtra.carrera;
    if (datosExtra.turno) alumno.turno = datosExtra.turno;
    if (datosExtra.grupo) alumno.grupo = datosExtra.grupo;

    return alumno;
}

exports.obtenerCostos = async (req, res) => {
    try {
        const monto = await getCostoSemestre();
        res.json({ costoPorSemestre: monto, costo: monto });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener costos' });
    }
};

exports.obtenerHistorialAlumno = async (req, res) => {
    const { controlNumber } = req.params;
    if (!controlNumber) return res.status(400).json({ error: 'Número de control requerido' });

    try {
        const COSTO_SEMESTRE = await getCostoSemestre();
        let alumno = await Student.findOne({ control: controlNumber });

        if (!alumno) {
            alumno = await findOrCreateStudent(controlNumber);
            await alumno.save();
        }

        const transacciones = await PaymentTransaction.find({ control: controlNumber })
            .sort({ timestamp: -1 })
            .lean();

        const txPorSemestre = {};
        transacciones.forEach(tx => {
            if (tx.accion === 'PAGAR' && !txPorSemestre[tx.semestre]) {
                txPorSemestre[tx.semestre] = tx;
            }
        });

        let totalRequerido = 0;
        let totalPagado = 0;
        const historialMovimientos = [];

        for (let i = 1; i <= 6; i++) {
            const semKey = `semestre_${i}`;
            const estaPagado = alumno[semKey] === true;
            const tx = txPorSemestre[i];

            totalRequerido += COSTO_SEMESTRE;
            if (estaPagado) totalPagado += COSTO_SEMESTRE;

            historialMovimientos.push({
                periodo: i,
                fecha: estaPagado
                    ? (tx ? new Date(tx.timestamp).toLocaleString('es-MX') : 'Registro previo')
                    : 'Pendiente',
                folio: estaPagado ? (tx?.folio || `LEG-${alumno.control}-${i}`) : '---------',
                tipoReferencia: estaPagado ? (tx?.tipoReferencia || '') : '',
                referencia: estaPagado ? (tx?.referencia || '') : '',
                costoBase: COSTO_SEMESTRE,
                costo: COSTO_SEMESTRE,
                abonado: estaPagado ? COSTO_SEMESTRE : 0,
                deuda: estaPagado ? 0 : COSTO_SEMESTRE,
            });
        }

        const apellidosDisplay = getApellidosDisplay(alumno);
        const split = splitApellidos(apellidosDisplay);

        return res.json({
            success: true,
            student: {
                noControl: alumno.control,
                name: `${alumno.nombre} ${apellidosDisplay}`.trim(),
                nombre: alumno.nombre,
                apellido_paterno: alumno.apellido_paterno || split.apellido_paterno,
                apellido_materno: alumno.apellido_materno || split.apellido_materno,
                carrera: alumno.carrera,
                grupo: alumno.grupo || 'A',
                turno: alumno.turno || 'MATUTINO',
                semestre_1: !!alumno.semestre_1,
                semestre_2: !!alumno.semestre_2,
                semestre_3: !!alumno.semestre_3,
                semestre_4: !!alumno.semestre_4,
                semestre_5: !!alumno.semestre_5,
                semestre_6: !!alumno.semestre_6,
            },
            summary: {
                totalCharged: totalRequerido,
                totalPaid: totalPagado,
                totalDebt: totalRequerido - totalPagado,
            },
            history: historialMovimientos,
        });
    } catch (error) {
        console.error('Error en expediente MongoDB:', error);
        return res.status(500).json({ error: 'Error en la base de datos' });
    }
};

const TIPOS_REFERENCIA = ['SPEI', 'OXXO', 'DEPOSITO', 'TRANSFERENCIA', 'FOLIO', 'OTRO'];

exports.modificarPago = async (req, res) => {
    let {
        control, semestre, estadoPago, nombre, paterno, materno, carrera, turno, grupo,
        tipoReferencia, referencia,
    } = req.body;

    if (estadoPago === 'REVERTIR' || estadoPago === false || estadoPago === 'false') estadoPago = false;
    else if (estadoPago === 'PAGAR' || estadoPago === true || estadoPago === 'true') estadoPago = true;
    else if (estadoPago === undefined) estadoPago = true;

    if (!control || !semestre) return res.status(400).json({ error: 'Faltan datos requeridos' });

    const semNum = parseInt(semestre, 10);
    if (semNum < 1 || semNum > 6) return res.status(400).json({ error: 'Semestre inválido' });

    if (isValidControl(control) === false && !String(control).startsWith('NI-')) {
        return res.status(400).json({ error: 'Número de control debe tener 14 dígitos numéricos' });
    }

    const operador = req.session?.user?.username || 'sistema';

    try {
        const semKey = `semestre_${semNum}`;
        const alumno = await findOrCreateStudent(control, { nombre, paterno, materno, carrera, turno, grupo });
        const estadoAnterior = alumno[semKey] === true;
        const monto = await getCostoSemestre();

        if (estadoPago === true && estadoAnterior) {
            return res.status(409).json({ error: `El ${semNum}° semestre ya está marcado como pagado` });
        }
        if (estadoPago === false && !estadoAnterior) {
            return res.status(409).json({ error: `El ${semNum}° semestre ya está pendiente` });
        }

        const refTipo = String(tipoReferencia || '').trim().toUpperCase();
        const refValor = String(referencia || '').trim();

        if (estadoPago === true) {
            if (!refTipo || !TIPOS_REFERENCIA.includes(refTipo)) {
                return res.status(400).json({ error: 'Indique el tipo de referencia del comprobante.' });
            }
            if (!refValor || refValor.length < 4) {
                return res.status(400).json({ error: 'La referencia debe tener al menos 4 caracteres.' });
            }
        }

        alumno[semKey] = estadoPago;
        await alumno.save();

        const accion = estadoPago ? 'PAGAR' : 'REVERTIR';
        const folio = generateFolio();

        await PaymentTransaction.create({
            control,
            semestre: semNum,
            accion,
            operador,
            monto: estadoPago ? monto : 0,
            folio,
            tipoReferencia: estadoPago ? refTipo : '',
            referencia: estadoPago ? refValor : '',
        });

        appendAudit({
            type: 'PAYMENT',
            control,
            semestre: semNum,
            accion,
            operador,
            folio,
            tipoReferencia: estadoPago ? refTipo : '',
            referencia: estadoPago ? refValor : '',
            timestamp: new Date().toISOString(),
        });

        await syncService.exportPagosToExcel();

        res.json({
            success: true,
            folio,
            accion,
            message: estadoPago
                ? `Pago del ${semNum}° semestre registrado`
                : `Pago del ${semNum}° semestre revertido`,
        });
    } catch (error) {
        console.error('Error modificando pago:', error);
        res.status(500).json({ error: 'No se pudo guardar el pago en MongoDB' });
    }
};

exports.guardarCostos = async (req, res) => {
    const { costo, sem1 } = req.body;
    const monto = Number(costo || sem1) || 2000;

    try {
        await Cost.findOneAndUpdate(
            { concepto: 'general' },
            { costoPorSemestre: monto },
            { upsert: true, returnDocument: 'after' }
        );
        res.status(200).json({ status: 'success', costoPorSemestre: monto, message: 'Costos guardados' });
    } catch (error) {
        res.status(500).json({ error: 'Error al persistir costos en MongoDB' });
    }
};

exports.registrarPago = exports.modificarPago;
