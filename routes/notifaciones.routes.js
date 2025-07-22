const express = require('express');
const router = express.Router();


const { enviarNotificacionesRecibos } = require('../controllers/notificaciones.controller');

// Ruta para enviar notificaciones de recibos
router.post('/recibos', enviarNotificacionesRecibos);

module.exports = router;