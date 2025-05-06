
const express = require('express');
const router = express.Router();
const { generarPDF } = require('../controllers/pdf.controller');

router.get('/:empleado/:periodo', generarPDF);

module.exports = router;
