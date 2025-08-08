const express = require('express');
const router = express.Router();
const { login, loginMobile, getProfile } = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Ruta para iniciar sesión con RFC
router.post('/login', login);
router.post('/loginMobile', loginMobile)
router.get('/profile', authMiddleware, getProfile)

module.exports = router;