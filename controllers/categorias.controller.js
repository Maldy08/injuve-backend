const { getDb } = require('../helpers/mongo.helper');

exports.getCategorias = async (req, res) => {
    try {
        const db = getDb();
        const categorias = await db.collection('mnom03').find({}).sort({ CATEGORIA: 1 }).toArray();
        res.json(categorias);
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.getCategoriaById = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        const categoria = await db.collection('mnom03').findOne({ CATEGORIA: parseInt(id) });
        
        if (!categoria) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }
        res.json(categoria);
    } catch (error) {
        console.error('Error al obtener la categoría:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.createCategoria = async (req, res) => {
    const { CATEGORIA, DESCRIPCION, SUELDO } = req.body;
    
    if (!CATEGORIA || !DESCRIPCION) {
        return res.status(400).json({ error: 'CATEGORIA y DESCRIPCION son requeridos' });
    }

    try {
        const db = getDb();
        
        // Verificar si ya existe
        const existingCategoria = await db.collection('mnom03').findOne({ CATEGORIA: parseInt(CATEGORIA) });
        if (existingCategoria) {
            return res.status(400).json({ error: 'El código de categoría ya existe' });
        }

        const result = await db.collection('mnom03').insertOne({
            CATEGORIA: parseInt(CATEGORIA),
            DESCRIPCION,
            SUELDO: SUELDO || "0" // SUELDO es string según requerimiento, opcional pero buena práctica inicializar
        });
        
        res.status(201).json({ message: 'Categoría creada exitosamente', id: result.insertedId });
    } catch (error) {
        console.error('Error al crear la categoría:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.updateCategoria = async (req, res) => {
    const { id } = req.params;
    const { DESCRIPCION, SUELDO } = req.body;

    if (!DESCRIPCION) {
        return res.status(400).json({ error: 'DESCRIPCION es requerida' });
    }

    try {
        const db = getDb();
        const updateData = { DESCRIPCION };
        if (SUELDO !== undefined) {
            updateData.SUELDO = SUELDO;
        }

        const result = await db.collection('mnom03').updateOne(
            { CATEGORIA: parseInt(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        res.json({ message: 'Categoría actualizada exitosamente' });
    } catch (error) {
        console.error('Error al actualizar la categoría:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.deleteCategoria = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        const result = await db.collection('mnom03').deleteOne({ CATEGORIA: parseInt(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        res.json({ message: 'Categoría eliminada exitosamente' });
    } catch (error) {
        console.error('Error al eliminar la categoría:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
