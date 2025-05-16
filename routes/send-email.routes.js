const express = require('express');
const router = express.Router();
const { enviarReciboPorCorreo, enviarRecibosPorCorreo} = require('../controllers/send-email.controller');

router.post('/enviar-recibo', enviarReciboPorCorreo);
router.post('/enviar-recibos', enviarRecibosPorCorreo);

module.exports = router;