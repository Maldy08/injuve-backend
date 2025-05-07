const express = require('express');
const router = express.Router();
const { enviarReciboPorCorreo } = require('../controllers/send-email.controller');

router.post('/enviar-recibo', enviarReciboPorCorreo);

module.exports = router;