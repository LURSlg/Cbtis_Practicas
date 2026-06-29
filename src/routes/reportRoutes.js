const express = require('express');
const router = express.Router();
const multer = require('multer');
const reportController = require('../controllers/reportController');
const turnoController = require('../controllers/turnoController');

const upload = multer({ dest: 'uploads/' });

router.post('/generar-lista-word', reportController.generarListaWord);
router.get('/export/lista.xlsx', reportController.exportListaExcel);
router.post('/admin/upload-db', upload.single('nuevaBD'), reportController.uploadDatabase);
router.get('/turno/resumen', turnoController.getResumen);
router.get('/turno/movimientos', turnoController.getMovimientos);

module.exports = router;
