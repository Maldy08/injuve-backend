const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { login, loginMobile, getProfile } = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Limita intentos de login: máximo 10 por IP cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rutas públicas de autenticación
router.post('/login', loginLimiter, login);
router.post('/loginMobile', loginLimiter, loginMobile);
router.get('/profile', authMiddleware, getProfile);

module.exports = router;