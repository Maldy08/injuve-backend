const express = require('express');
const router = express.Router();


const { enviarNotificacionesRecibos, guardarToken } = require('../controllers/notificaciones.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Ruta para enviar notificaciones de recibos
router.post('/recibos', enviarNotificacionesRecibos);
router.post('/guardarToken', authMiddleware ,guardarToken);

module.exports = router;