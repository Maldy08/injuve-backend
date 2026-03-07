const express = require('express');
const router = express.Router();
const {
    getSueldosPrestacionesBase,
    getSueldoPrestacionBaseById,
    createSueldoPrestacionBase,
    updateSueldoPrestacionBase,
    deleteSueldoPrestacionBase
} = require('../controllers/sueldoprestacionesbase.controller');

router.get('/', getSueldosPrestacionesBase);
router.get('/:id', getSueldoPrestacionBaseById);
router.post('/', createSueldoPrestacionBase);
router.put('/:id', updateSueldoPrestacionBase);
router.delete('/:id', deleteSueldoPrestacionBase);

module.exports = router;
