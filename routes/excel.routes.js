const express = require('express');
const router = express.Router();
const {generarTimbrado} = require('../controllers/excel.controller');

router.get('/:periodo/:tipo', generarTimbrado);  

module.exports = router; 