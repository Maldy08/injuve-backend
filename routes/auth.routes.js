const express = require('express');
const router = express.Router();
const {login} = require('../controllers/auth.controller');

// Ruta para iniciar sesión con RFC
router.post('/login', login);

module.exports = router;