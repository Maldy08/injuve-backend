
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); 
const { uploadExcelBss, exportarBssXml,exportarBssTxt, getDatosBSS, exportarBssZip } = require('../controllers/bss.controller');

router.get('/exportar-xml/:periodo/:banco',exportarBssXml);
router.get('/exportar-txt/:periodo/:banco',exportarBssTxt);
router.get('/exportar-zip/:periodo/:banco', exportarBssZip);
router.get('/get-datos-bss', getDatosBSS);
router.post('/upload', upload.single('file'), uploadExcelBss);

module.exports = router;

