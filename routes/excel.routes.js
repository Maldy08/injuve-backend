const express = require('express');
const router = express.Router();
const {generarTimbrado, percepcionesPivotPorPeriodo, percepcionesPivotJsonPorPeriodo, generarNomOrd, generarNomOrdDetalle} = require('../controllers/excel.controller');

router.get('/percepciones/:periodo', percepcionesPivotPorPeriodo);
router.get('/nom-ord-detalle/:anio/:tipo', generarNomOrdDetalle);
router.get('/nom-ord/:anio/:tipo', generarNomOrd);
router.get('/:periodo/:tipo', generarTimbrado);
router.get('/percepciones/json/:periodo', percepcionesPivotJsonPorPeriodo);

module.exports = router; 