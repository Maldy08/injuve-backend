const express = require('express');
const router = express.Router();
const { getBitacoraEnvios, getPasos } = require('../controllers/bitacora.controller');

// Catálogo de pasos para filtros del cliente.
router.get('/pasos', getPasos);
// Listado paginado de errores de envío.
router.get('/', getBitacoraEnvios);

module.exports = router;
