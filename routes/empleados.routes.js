const express = require('express');
const router = express.Router();
const { getEmpleados, getEmpleadoById } = require('../controllers/empleados.controller');

router.get('/:tipo', getEmpleados);
router.get('/:tipo/:id', getEmpleadoById);

module.exports = router;