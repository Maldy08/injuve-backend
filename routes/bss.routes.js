
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); 
const { uploadExcelBss, exportarBssXml,exportarBssTxt } = require('../controllers/bss.controller');

router.get('/exportar-xml/:periodo/:banco',exportarBssXml);
router.get('/exportar-txt/:periodo/:banco',exportarBssTxt);
router.post('/upload', upload.single('file'), uploadExcelBss);

module.exports = router;

