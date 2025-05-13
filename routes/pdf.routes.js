
const express = require('express');
const router = express.Router();
const { generarPDF } = require('../controllers/pdf.controller');

router.get('/:empleado/:periodo/:tipo', generarPDF);

module.exports = router;
