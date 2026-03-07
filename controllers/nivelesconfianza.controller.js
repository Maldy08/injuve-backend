const { getDb } = require('../helpers/mongo.helper');

const COLLECTION_NAME = 'nivelesconfianza';
const REQUIRED_NUMERIC_FIELDS = [
    'NIVEL',
    'SUELDO',
    'CANASTABASICA',
    'BONOTRANSPORTE',
    'PREVISIONSOCIAL',
    'FOMENTOEDUCATIVO'
];

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function parsePayload(payload, requireAllFields = false) {
    const parsed = {};

    for (const field of REQUIRED_NUMERIC_FIELDS) {
        if (payload[field] === undefined) {
            if (requireAllFields) {
                return { error: `El campo ${field} es requerido` };
            }
            continue;
        }

        const parsedValue = toNumber(payload[field]);
        if (parsedValue === null) {
            return { error: `El campo ${field} debe ser numérico` };
        }
        parsed[field] = parsedValue;
    }

    return { data: parsed };
}

exports.getNivelesConfianza = async (req, res) => {
    try {
        const db = getDb();
        const niveles = await db.collection(COLLECTION_NAME).find({}).sort({ NIVEL: 1 }).toArray();
        res.json(niveles);
    } catch (error) {
        console.error('Error al obtener niveles de confianza:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.getNivelConfianzaById = async (req, res) => {
    const nivelId = toNumber(req.params.id);
    if (nivelId === null) {
        return res.status(400).json({ error: 'El id debe ser numérico' });
    }

    try {
        const db = getDb();
        const nivel = await db.collection(COLLECTION_NAME).findOne({ NIVEL: nivelId });

        if (!nivel) {
            return res.status(404).json({ error: 'Nivel de confianza no encontrado' });
        }

        res.json(nivel);
    } catch (error) {
        console.error('Error al obtener nivel de confianza:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.createNivelConfianza = async (req, res) => {
    const parsedPayload = parsePayload(req.body, true);
    if (parsedPayload.error) {
        return res.status(400).json({ error: parsedPayload.error });
    }

    try {
        const db = getDb();
        const existingNivel = await db.collection(COLLECTION_NAME).findOne({ NIVEL: parsedPayload.data.NIVEL });
        if (existingNivel) {
            return res.status(400).json({ error: 'El NIVEL ya existe' });
        }

        const result = await db.collection(COLLECTION_NAME).insertOne(parsedPayload.data);
        res.status(201).json({ message: 'Nivel de confianza creado exitosamente', id: result.insertedId });
    } catch (error) {
        console.error('Error al crear nivel de confianza:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.updateNivelConfianza = async (req, res) => {
    const nivelId = toNumber(req.params.id);
    if (nivelId === null) {
        return res.status(400).json({ error: 'El id debe ser numérico' });
    }

    const parsedPayload = parsePayload(req.body, false);
    if (parsedPayload.error) {
        return res.status(400).json({ error: parsedPayload.error });
    }

    if (parsedPayload.data.NIVEL !== undefined && parsedPayload.data.NIVEL !== nivelId) {
        return res.status(400).json({ error: 'NIVEL no puede ser diferente al id de la ruta' });
    }

    const updateData = { ...parsedPayload.data };
    delete updateData.NIVEL;

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
    }

    try {
        const db = getDb();
        const result = await db.collection(COLLECTION_NAME).updateOne(
            { NIVEL: nivelId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Nivel de confianza no encontrado' });
        }

        res.json({ message: 'Nivel de confianza actualizado exitosamente' });
    } catch (error) {
        console.error('Error al actualizar nivel de confianza:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.deleteNivelConfianza = async (req, res) => {
    const nivelId = toNumber(req.params.id);
    if (nivelId === null) {
        return res.status(400).json({ error: 'El id debe ser numérico' });
    }

    try {
        const db = getDb();
        const result = await db.collection(COLLECTION_NAME).deleteOne({ NIVEL: nivelId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Nivel de confianza no encontrado' });
        }

        res.json({ message: 'Nivel de confianza eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar nivel de confianza:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
