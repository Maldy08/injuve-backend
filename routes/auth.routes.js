const express = require('express');
const router = express.Router();
const {login, loginMobile} = require('../controllers/auth.controller');

// Ruta para iniciar sesión con RFC
router.post('/login', login);
router.post('/loginMobile',loginMobile)

module.exports = router;