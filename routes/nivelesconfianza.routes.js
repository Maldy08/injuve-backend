const express = require('express');
const router = express.Router();
const {
    getNivelesConfianza,
    getNivelConfianzaById,
    createNivelConfianza,
    updateNivelConfianza,
    deleteNivelConfianza
} = require('../controllers/nivelesconfianza.controller');

router.get('/', getNivelesConfianza);
router.get('/:id', getNivelConfianzaById);
router.post('/', createNivelConfianza);
router.put('/:id', updateNivelConfianza);
router.delete('/:id', deleteNivelConfianza);

module.exports = router;
