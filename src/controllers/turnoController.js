const PaymentTransaction = require('../models/PaymentTransaction');

function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

exports.getResumen = async (req, res) => {
    try {
        const since = startOfToday();
        const operador = req.session?.user?.username;

        const baseFilter = { timestamp: { $gte: since } };
        const pagosFilter = { ...baseFilter, accion: 'PAGAR' };
        if (operador) pagosFilter.operador = operador;

        const [pagos, totalOperaciones, reversiones] = await Promise.all([
            PaymentTransaction.find(pagosFilter).lean(),
            PaymentTransaction.countDocuments(operador ? { ...baseFilter, operador } : baseFilter),
            PaymentTransaction.countDocuments({ ...baseFilter, accion: 'REVERTIR', ...(operador ? { operador } : {}) }),
        ]);

        res.json({
            validados: pagos.length,
            totalOperaciones,
            reversiones,
            montoRecaudado: pagos.reduce((sum, p) => sum + (p.monto || 0), 0),
            operador: operador || null,
            fecha: since.toISOString().slice(0, 10),
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener resumen de turno' });
    }
};

exports.getMovimientos = async (req, res) => {
    try {
        const since = startOfToday();
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
        const operador = req.session?.user?.username;

        const filter = { timestamp: { $gte: since } };
        if (operador) filter.operador = operador;

        const movimientos = await PaymentTransaction.find(filter)
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        res.json({
            data: movimientos.map(m => ({
                control: m.control,
                semestre: m.semestre,
                accion: m.accion,
                operador: m.operador,
                folio: m.folio,
                monto: m.monto,
                tipoReferencia: m.tipoReferencia || '',
                referencia: m.referencia || '',
                hora: new Date(m.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
                timestamp: m.timestamp,
            })),
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener movimientos' });
    }
};
