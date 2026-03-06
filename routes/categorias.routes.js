const express = require('express');
const router = express.Router();
const { 
    getCategorias, 
    getCategoriaById, 
    createCategoria, 
    updateCategoria, 
    deleteCategoria 
} = require('../controllers/categorias.controller');

router.get('/', getCategorias);
router.get('/:id', getCategoriaById);
router.post('/', createCategoria);
router.put('/:id', updateCategoria);
router.delete('/:id', deleteCategoria);

module.exports = router;
