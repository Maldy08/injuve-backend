const { getDb } = require('../helpers/mongo.helper');

const COLLECTION_NAME = 'sueldoprestacionesconf';
const REQUIRED_NUMERIC_FIELDS = [
    'EMPLEADO',
    'SUELDOMES',
    'SUELDODIA',
    'CANASTABASICA',
    'BONOTRANSPORTE',
    'PREVISIONSOCIAL',
    'FOMENTOEDUCATIVO',
    'QUINQUENIO',
    'AGUICATORCENAL',
    'SUELDOINTEGRADO'
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

exports.getSueldosPrestacionesConf = async (req, res) => {
    try {
        const db = getDb();
        const rows = await db.collection(COLLECTION_NAME).find({}).sort({ EMPLEADO: 1 }).toArray();
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener sueldos y prestaciones confianza:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.getSueldoPrestacionConfById = async (req, res) => {
    const empleadoId = toNumber(req.params.id);
    if (empleadoId === null) {
        return res.status(400).json({ error: 'El id debe ser numérico' });
    }

    try {
        const db = getDb();
        const row = await db.collection(COLLECTION_NAME).findOne({ EMPLEADO: empleadoId });

        if (!row) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        res.json(row);
    } catch (error) {
        console.error('Error al obtener registro confianza:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.createSueldoPrestacionConf = async (req, res) => {
    const parsedPayload = parsePayload(req.body, true);
    if (parsedPayload.error) {
        return res.status(400).json({ error: parsedPayload.error });
    }

    try {
        const db = getDb();
        const existing = await db.collection(COLLECTION_NAME).findOne({ EMPLEADO: parsedPayload.data.EMPLEADO });
        if (existing) {
            return res.status(400).json({ error: 'El EMPLEADO ya existe' });
        }

        const result = await db.collection(COLLECTION_NAME).insertOne(parsedPayload.data);
        res.status(201).json({ message: 'Registro creado exitosamente', id: result.insertedId });
    } catch (error) {
        console.error('Error al crear registro confianza:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.updateSueldoPrestacionConf = async (req, res) => {
    const empleadoId = toNumber(req.params.id);
    if (empleadoId === null) {
        return res.status(400).json({ error: 'El id debe ser numérico' });
    }

    const parsedPayload = parsePayload(req.body, false);
    if (parsedPayload.error) {
        return res.status(400).json({ error: parsedPayload.error });
    }

    if (parsedPayload.data.EMPLEADO !== undefined && parsedPayload.data.EMPLEADO !== empleadoId) {
        return res.status(400).json({ error: 'EMPLEADO no puede ser diferente al id de la ruta' });
    }

    const updateData = { ...parsedPayload.data };
    delete updateData.EMPLEADO;

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
    }

    try {
        const db = getDb();
        const result = await db.collection(COLLECTION_NAME).updateOne(
            { EMPLEADO: empleadoId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        res.json({ message: 'Registro actualizado exitosamente' });
    } catch (error) {
        console.error('Error al actualizar registro confianza:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.deleteSueldoPrestacionConf = async (req, res) => {
    const empleadoId = toNumber(req.params.id);
    if (empleadoId === null) {
        return res.status(400).json({ error: 'El id debe ser numérico' });
    }

    try {
        const db = getDb();
        const result = await db.collection(COLLECTION_NAME).deleteOne({ EMPLEADO: empleadoId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        res.json({ message: 'Registro eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar registro confianza:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
