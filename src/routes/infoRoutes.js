const express = require('express');
const router = express.Router();
const infoController = require('../controllers/infoController');

router.get('/health', infoController.health);
router.get('/current-period', infoController.getCurrentPeriod);
router.get('/alumnos', infoController.getAlumnos);
router.get('/alumnos/search', infoController.searchAlumnos);
router.get('/registros', infoController.getRegistros);
router.get('/listas', infoController.getListasFiltered);
router.get('/groups', infoController.getGroups);
router.get('/audits', infoController.getAudits);
router.post('/sync/excel', infoController.syncFromExcel);
router.post('/export/pagos', infoController.exportToExcel);

module.exports = router;
