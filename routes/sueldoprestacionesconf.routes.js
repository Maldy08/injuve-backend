const express = require('express');
const router = express.Router();
const {
    getSueldosPrestacionesConf,
    getSueldoPrestacionConfById,
    createSueldoPrestacionConf,
    updateSueldoPrestacionConf,
    deleteSueldoPrestacionConf
} = require('../controllers/sueldoprestacionesconf.controller');

router.get('/', getSueldosPrestacionesConf);
router.get('/:id', getSueldoPrestacionConfById);
router.post('/', createSueldoPrestacionConf);
router.put('/:id', updateSueldoPrestacionConf);
router.delete('/:id', deleteSueldoPrestacionConf);

module.exports = router;
