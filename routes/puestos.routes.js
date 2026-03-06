const express = require('express');
const router = express.Router();
const { 
    getPuestos, 
    getPuestoById, 
    createPuesto, 
    updatePuesto, 
    deletePuesto 
} = require('../controllers/puestos.controller');

router.get('/', getPuestos);
router.get('/:id', getPuestoById);
router.post('/', createPuesto);
router.put('/:id', updatePuesto);
router.delete('/:id', deletePuesto);

module.exports = router;
