const express = require('express');
const router = express.Router();
const { obtenerResumen, obtenerJson, recibos } = require('../controllers/nomina.controller');

// Devuelve el resumen de todos los recibos del empleado
router.get('/recibos/:empleado/:tipo', obtenerResumen);

// Devuelve el JSON completo del recibo de un periodo específico
router.get('/recibos/json/:empleado/:periodo/:tipo', obtenerJson);

router.get('/recibos/:tipo', recibos);

module.exports = router;
