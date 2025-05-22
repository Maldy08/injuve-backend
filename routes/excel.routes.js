const express = require('express');
const router = express.Router();
const {generarTimbrado, percepcionesPivotPorPeriodo} = require('../controllers/excel.controller');

router.get('/pivot/:periodo', percepcionesPivotPorPeriodo);
router.get('/:periodo/:tipo', generarTimbrado);  


module.exports = router; 