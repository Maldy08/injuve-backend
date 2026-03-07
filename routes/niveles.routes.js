const express = require('express');
const router = express.Router();
const {
    getNiveles,
    getNivelById,
    createNivel,
    updateNivel,
    deleteNivel
} = require('../controllers/niveles.controller');

router.get('/', getNiveles);
router.get('/:id', getNivelById);
router.post('/', createNivel);
router.put('/:id', updateNivel);
router.delete('/:id', deleteNivel);

module.exports = router;
