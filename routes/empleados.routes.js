const express = require('express');
const router = express.Router();
const { getEmpleados, getEmpleadoById } = require('../controllers/empleados.controller');

router.get('/', getEmpleados);
router.get('/:id', getEmpleadoById);

module.exports = router;