const mongoose = require('mongoose');
const { splitApellidos, getApellidosDisplay } = require('../utils/studentHelper');

const StudentSchema = new mongoose.Schema({
    control: { type: String, required: true, unique: true, index: true },
    nombre: { type: String, required: true, default: '' },
    apellido_paterno: { type: String, default: '' },
    apellido_materno: { type: String, default: '' },
    apellidos: { type: String, default: '' },
    carrera: { type: String, default: '' },
    turno: { type: String, default: 'MATUTINO' },
    grupo: { type: String, default: 'A' },
    semestre_actual: { type: Number, min: 1, max: 6 },
    semestre_1: { type: Boolean, default: false },
    semestre_2: { type: Boolean, default: false },
    semestre_3: { type: Boolean, default: false },
    semestre_4: { type: Boolean, default: false },
    semestre_5: { type: Boolean, default: false },
    semestre_6: { type: Boolean, default: false },
    ciclo_escolar: { type: String, default: '' },
    activo: { type: Boolean, default: true },
}, { timestamps: true });

StudentSchema.index({ carrera: 1, turno: 1, grupo: 1 });
StudentSchema.index({ activo: 1, control: 1 });

StudentSchema.pre('save', function syncApellidos() {
    if (this.apellido_paterno || this.apellido_materno) {
        this.apellidos = getApellidosDisplay(this);
    } else if (this.apellidos) {
        const split = splitApellidos(this.apellidos);
        this.apellido_paterno = split.apellido_paterno;
        this.apellido_materno = split.apellido_materno;
    }
});

module.exports = mongoose.model('Student', StudentSchema);
