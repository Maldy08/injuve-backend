const express = require('express');
const router = express.Router();
const {generarExcel} = require('../controllers/excel.controller');

router.get('/', generarExcel);  

module.exports = router; 