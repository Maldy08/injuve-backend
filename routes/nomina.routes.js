const express = require('express');
const router = express.Router();
const { obtenerResumen, obtenerJson } = require('../controllers/nomina.controller');

// Devuelve el resumen de todos los recibos del empleado
router.get('/recibos/:empleado', obtenerResumen);

// Devuelve el JSON completo del recibo de un periodo específico
router.get('/recibos/json/:empleado/:periodo', obtenerJson);

module.exports = router;
