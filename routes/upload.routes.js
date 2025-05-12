
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { subirCSV } = require('../controllers/upload.controller');

// Configurar almacenamiento temporal
const upload = multer({ dest: path.join(__dirname, '../uploads') });

router.post('/:coleccion', upload.single('archivo'), subirCSV);

module.exports = router;
