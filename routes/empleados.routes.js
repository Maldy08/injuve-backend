const express = require('express');
const router = express.Router();
const { getEmpleados, getEmpleadoById, getEmpleadosVacaciones, updateEmpleado } = require('../controllers/empleados.controller');

router.get('/vacaciones', getEmpleadosVacaciones);
router.get('/:tipo', getEmpleados);
router.get('/:tipo/:id', getEmpleadoById);
router.put('/:tipo/:id', updateEmpleado);

module.exports = router;