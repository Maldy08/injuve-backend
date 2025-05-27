
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); 
const { uploadExcelBss, exportarBssXml,exportarBssTxt } = require('../controllers/bss.controller');

router.post('/upload', upload.single('file'), uploadExcelBss);
router.get('/exportar-xml',exportarBssXml);
router.get('/exportar-txt/:banco',exportarBssTxt);

module.exports = router;

