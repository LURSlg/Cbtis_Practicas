const mongoose = require('mongoose');

const PaymentTransactionSchema = new mongoose.Schema({
    control: { type: String, required: true, index: true },
    semestre: { type: Number, required: true, min: 1, max: 6 },
    accion: { type: String, enum: ['PAGAR', 'REVERTIR'], required: true },
    operador: { type: String, required: true, index: true },
    monto: { type: Number, default: 0 },
    folio: { type: String, required: true, unique: true },
    tipoReferencia: { type: String, default: '' },
    referencia: { type: String, default: '', index: true },
    timestamp: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

PaymentTransactionSchema.index({ operador: 1, timestamp: -1 });
PaymentTransactionSchema.index({ timestamp: -1, accion: 1 });

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
