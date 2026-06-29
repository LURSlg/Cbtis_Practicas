const mongoose = require('mongoose');

const RegistrationRequestSchema = new mongoose.Schema({
    username: { type: String, required: true, trim: true, index: true },
    nombreCompleto: { type: String, default: '' },
    motivo: { type: String, default: '' },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
    rejectReason: { type: String, default: '' },
}, { timestamps: true });

RegistrationRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('RegistrationRequest', RegistrationRequestSchema);
