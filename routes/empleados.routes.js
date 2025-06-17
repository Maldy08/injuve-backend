const express = require('express');
const router = express.Router();
const { getEmpleados, getEmpleadoById, getEmpleadosVacaciones } = require('../controllers/empleados.controller');

router.get('/vacaciones', getEmpleadosVacaciones);
router.get('/:tipo', getEmpleados);
router.get('/:tipo/:id', getEmpleadoById);

module.exports = router;