const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.get('/costs', paymentController.obtenerCostos);
router.post('/costs', paymentController.guardarCostos);
router.post('/registrar-pago', paymentController.registrarPago);
router.post('/modificar-pago', paymentController.modificarPago);
router.get('/students/:controlNumber/payments', paymentController.obtenerHistorialAlumno);

module.exports = router;
