// src/models/Cost.js
const mongoose = require('mongoose');

const CostSchema = new mongoose.Schema({
    concepto: { 
        type: String, 
        required: true, 
        unique: true, 
        default: 'general' 
    },
    costoPorSemestre: { 
        type: Number, 
        required: true, 
        default: 2000 
    }
});

module.exports = mongoose.model('Cost', CostSchema);