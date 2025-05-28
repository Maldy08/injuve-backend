const express = require('express');
const router = express.Router();
const {generarTimbrado, percepcionesPivotPorPeriodo, percepcionesPivotJsonPorPeriodo} = require('../controllers/excel.controller');

router.get('/percepciones/:periodo', percepcionesPivotPorPeriodo);
router.get('/:periodo/:tipo', generarTimbrado);  
router.get('/percepciones/json/:periodo', percepcionesPivotJsonPorPeriodo);

module.exports = router; 