const { getDb } = require('../helpers/mongo.helper');
const { COLECCION, PASOS } = require('../helpers/bitacora-envio.helper');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function toNumber(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function parseFecha(value) {
    if (!value) {
        return null;
    }
    const fecha = new Date(value);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// Construye el filtro de Mongo a partir de los query params soportados.
// Todos son opcionales; los inválidos se ignoran en silencio para no
// romper la consulta por un parámetro mal formado.
function buildFiltro(query) {
    const filtro = {};

    const periodo = toNumber(query.periodo);
    if (periodo !== null) {
        filtro.periodo = periodo;
    }

    const tipo = toNumber(query.tipo);
    if (tipo !== null) {
        filtro.tipo = tipo;
    }

    if (query.modo) {
        filtro.modo = String(query.modo);
    }

    if (query.paso) {
        filtro.paso = String(query.paso);
    }

    const desde = parseFecha(query.desde);
    const hasta = parseFecha(query.hasta);
    if (desde || hasta) {
        filtro.fecha = {};
        if (desde) {
            filtro.fecha.$gte = desde;
        }
        if (hasta) {
            filtro.fecha.$lte = hasta;
        }
    }

    return filtro;
}

// GET /api/backend/bitacora-envios
// Lista los errores de envío de recibos registrados en bitacora_envio_recibos,
// ordenados del más reciente al más antiguo, con filtros y paginación.
exports.getBitacoraEnvios = async (req, res) => {
    try {
        const db = getDb();
        const filtro = buildFiltro(req.query);

        const limitRaw = toNumber(req.query.limit);
        const limit = Math.min(limitRaw && limitRaw > 0 ? limitRaw : DEFAULT_LIMIT, MAX_LIMIT);
        const skipRaw = toNumber(req.query.skip);
        const skip = skipRaw && skipRaw > 0 ? skipRaw : 0;

        const coleccion = db.collection(COLECCION);
        const [items, total] = await Promise.all([
            coleccion.find(filtro).sort({ fecha: -1 }).skip(skip).limit(limit).toArray(),
            coleccion.countDocuments(filtro)
        ]);

        res.json({ total, limit, skip, items });
    } catch (error) {
        console.error('Error al obtener la bitácora de envíos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// GET /api/backend/bitacora-envios/pasos
// Devuelve el catálogo de etiquetas de `paso` para que el cliente pueda
// armar filtros sin hardcodearlas.
exports.getPasos = (req, res) => {
    res.json(Object.values(PASOS));
};
