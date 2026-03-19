
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { subirCSV, subirMDB } = require('../controllers/upload.controller');

// Almacenamiento temporal para CSV
const upload = multer({ dest: path.join(__dirname, '../uploads') });

// Almacenamiento temporal para MDB con validación de extensión
const uploadMDB = multer({
  dest: path.join(__dirname, '../uploads'),
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.mdb') {
      return cb(new Error('Solo se permiten archivos .mdb'));
    }
    cb(null, true);
  }
});

// Ruta para respaldo de base de datos .mdb
router.post('/backup-mdb', (req, res, next) => {
  uploadMDB.single('archivo')(req, res, (err) => {
    if (err) return res.status(400).json({ mensaje: '❌ ' + err.message });
    next();
  });
}, subirMDB);

router.post('/:coleccion', upload.single('archivo'), subirCSV);

module.exports = router;
