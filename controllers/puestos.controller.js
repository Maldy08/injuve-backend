const { getDb } = require('../helpers/mongo.helper');

exports.getPuestos = async (req, res) => {
    try {
        const db = getDb();
        const puestos = await db.collection('mnom90').find({}).sort({ PUESTO: 1 }).toArray();
        res.json(puestos);
    } catch (error) {
        console.error('Error al obtener puestos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.getPuestoById = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        const puesto = await db.collection('mnom90').findOne({ PUESTO: parseInt(id) });
        
        if (!puesto) {
            return res.status(404).json({ error: 'Puesto no encontrado' });
        }
        res.json(puesto);
    } catch (error) {
        console.error('Error al obtener el puesto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.createPuesto = async (req, res) => {
    const { PUESTO, DESCRIPCION } = req.body;
    
    if (!PUESTO || !DESCRIPCION) {
        return res.status(400).json({ error: 'PUESTO y DESCRIPCION son requeridos' });
    }

    try {
        const db = getDb();
        
        // Verificar si ya existe
        const existingPuesto = await db.collection('mnom90').findOne({ PUESTO: parseInt(PUESTO) });
        if (existingPuesto) {
            return res.status(400).json({ error: 'El código de puesto ya existe' });
        }

        const result = await db.collection('mnom90').insertOne({
            PUESTO: parseInt(PUESTO),
            DESCRIPCION
        });
        
        res.status(201).json({ message: 'Puesto creado exitosamente', id: result.insertedId });
    } catch (error) {
        console.error('Error al crear el puesto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.updatePuesto = async (req, res) => {
    const { id } = req.params;
    const { DESCRIPCION } = req.body;

    if (!DESCRIPCION) {
        return res.status(400).json({ error: 'DESCRIPCION es requerida' });
    }

    try {
        const db = getDb();
        const result = await db.collection('mnom90').updateOne(
            { PUESTO: parseInt(id) },
            { $set: { DESCRIPCION } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Puesto no encontrado' });
        }

        res.json({ message: 'Puesto actualizado exitosamente' });
    } catch (error) {
        console.error('Error al actualizar el puesto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.deletePuesto = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        const result = await db.collection('mnom90').deleteOne({ PUESTO: parseInt(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Puesto no encontrado' });
        }

        res.json({ message: 'Puesto eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar el puesto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
