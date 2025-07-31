const { getDb } = require('../helpers/mongo.helper');
const formatearFechaTexto = require('../helpers/formatear-fecha-texto');
const numeroALetras = require('../helpers/numeros-letras');

exports.resumenPorPeriodo = async (req, res) => {
  const tipo = parseInt(req.params.tipo);
  if (isNaN(tipo)) {
    return res.status(400).json({ error: "Parámetro tipo inválido" });
  }

  try {
    const db = getDb();
    let resumen = [];
    const collection = tipo === 1 ? 'mnom12' : 'mnom12h';

    resumen = await db.collection(collection).aggregate([
      {
        $group: {
          _id: "$PERIODO",
          percepciones: {
            $sum: {
              $cond: [{ $lt: ["$PERCDESC", 500] }, "$IMPORTE", 0]
            }
          },
          deducciones: {
            $sum: {
              $cond: [{ $gte: ["$PERCDESC", 500] }, "$IMPORTE", 0]
            }
          },
          FECHADES: { $first: "$FECHDES" },
          FECHHAS: { $first: "$FECHHAS" }
        }
      },
      {
        $addFields: {
          neto: { $subtract: ["$percepciones", "$deducciones"] }
        }
      },
      {
        $project: {
          _id: 0,
          PERIODO: "$_id",
          FECHAPAGO: {
            $cond: [
              { $and: [{ $ifNull: ["$FECHDES", false] }, { $ifNull: ["$FECHHAS", false] }] },
              { $concat: ["$FECHDES", " al ", "$FECHHAS"] },
              { $ifNull: ["$FECHDES", { $ifNull: ["$FECHHAS", ""] }] }
            ]
          },
          PERCEPCIONES: { $round: ["$percepciones", 2] },
          DEDUCCIONES: { $round: ["$deducciones", 2] },
          NETO: { $round: ["$neto", 2] }
        }
      },
      { $sort: { PERIODO: -1 } }
    ]).toArray();

    res.json(resumen);
  } catch (error) {
    console.error('Error al obtener resumen por periodo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};



// GET /api/nomina/recibos/:empleado/:tipo
exports.obtenerResumen = async (req, res) => {
  const empleado = parseInt(req.params.empleado);
  const tipo = parseInt(req.params.tipo);

  if (isNaN(empleado) || isNaN(tipo)) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  try {
    const db = getDb();
    let conceptosRaw;
    conceptosRaw = tipo == 1 ? await db.collection('mnom12').find({ EMPLEADO: empleado }).toArray()
      : await db.collection('mnom12h').find({ EMPLEADO: empleado }).toArray();
    if (conceptosRaw.length === 0) {
      return res.status(404).json({ error: "No se encontraron recibos para el empleado" });
    }

    const agrupados = {};
    for (const c of conceptosRaw) {
      const periodo = c.PERIODO;
      if (!agrupados[periodo]) {
        agrupados[periodo] = {
          periodo,
          empleado: c.EMPLEADO,
          fechaPago: `${formatearFechaTexto(c.FECHDES)} al ${formatearFechaTexto(c.FECHHAS)}`,
          percepciones: 0,
          prestaciones: 0,
          deducciones: 0,
        };
      }

      if (c.PERCDESC >= 1 && c.PERCDESC < 13) {
        agrupados[periodo].percepciones += c.IMPORTE;
      } else if (c.PERCDESC >= 13 && c.PERCDESC < 500) {
        agrupados[periodo].prestaciones += c.IMPORTE;
      } else if (c.PERCDESC >= 500) {
        agrupados[periodo].deducciones += c.IMPORTE;
      }
    }

    const resumen = Object.values(agrupados).map(r => ({
      ...r,
      percepciones: r.percepciones.toFixed(2),
      prestaciones: r.prestaciones.toFixed(2),
      deducciones: r.deducciones.toFixed(2),
      neto: (r.percepciones + r.prestaciones - r.deducciones).toFixed(2)
    })).sort((a, b) => a.periodo - b.periodo);

    res.json(resumen);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener recibos" });
  }
};

// GET /api/nomina/json/:empleado/:periodo
exports.obtenerJson = async (req, res) => {
  const empleado = parseInt(req.params.empleado);
  const periodo = parseInt(req.params.periodo);
  const tipo = parseInt(req.params.tipo);

  if (isNaN(empleado) || isNaN(periodo) || isNaN(tipo)) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  try {
    const db = getDb();
    const filtroPeriodo = periodo === 0 ? {} : { PERIODO: periodo };

    const conceptosRaw = tipo == 1 ? await db.collection('mnom12').find({ EMPLEADO: empleado, ...filtroPeriodo }).toArray() : await db.collection('mnom12h').find({ EMPLEADO: empleado, ...filtroPeriodo }).toArray();
    const empleadoData = tipo == 1 ? await db.collection('mnom01').findOne({ EMPLEADO: empleado }) : await db.collection('mnom01h').findOne({ EMPLEADO: empleado });
    const deptoData = tipo == 1 ? await db.collection('mnom04').findOne({ DEPTO: empleadoData.DEPTO }) : [{
      DESCRIPCION: "N/A"
    }];

    const percepciones = tipo == 1 ? conceptosRaw.filter(c => c.PERCDESC >= 1 && c.PERCDESC < 13) : conceptosRaw.filter(c => c.PERCDESC >= 1 && c.PERCDESC <= 23);
    const prestaciones = tipo == 1 ? conceptosRaw.filter(c => c.PERCDESC >= 13 && c.PERCDESC < 500) : conceptosRaw.filter(c => c.PERCDESC >= 24 && c.PERCDESC < 500);
    const deducciones = conceptosRaw.filter(c => c.PERCDESC >= 500);

    const totalPercepciones = percepciones.reduce((s, c) => s + c.IMPORTE, 0);
    const totalPrestaciones = prestaciones.reduce((s, c) => s + c.IMPORTE, 0);
    const totalDeducciones = deducciones.reduce((s, c) => s + c.IMPORTE, 0);

    const conceptos = conceptosRaw.map(c => ({
      ...c,
      percepcion: (c.PERCDESC >= 1 && c.PERCDESC < 13) ? `${c.IMPORTE.toFixed(2)}` : "",
      prestacion: (c.PERCDESC >= 13 && c.PERCDESC < 500) ? `${c.IMPORTE.toFixed(2)}` : "",
      deduccion: (c.PERCDESC >= 500) ? `${c.IMPORTE.toFixed(2)}` : ""
    }));

    res.json({
      empleado: empleadoData,
      periodo,
      depto: deptoData.DESCRIPCION,
      fechaPago: `${formatearFechaTexto(conceptosRaw[0]?.FECHDES)} al ${formatearFechaTexto(conceptosRaw[0]?.FECHHAS)}`,
      conceptos,
      totales: {
        percepciones: totalPercepciones.toFixed(2),
        prestaciones: totalPrestaciones.toFixed(2),
        deducciones: totalDeducciones.toFixed(2),
        neto: (totalPercepciones + totalPrestaciones - totalDeducciones).toFixed(2)
      },
      cantidadLetras: numeroALetras(totalPercepciones + totalPrestaciones - totalDeducciones),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.recibos = async (req, res) => {
  const tipo = parseInt(req.params.tipo);
  if (isNaN(tipo)) {
    return res.status(400).json({ error: "Parámetro tipo inválido" });
  }

  try {
    const db = getDb();
    let resumen = [];
    if (tipo === 1) {
      resumen = await db.collection('mnom12').aggregate([
        {
          $group: {
            _id: { EMPLEADO: "$EMPLEADO", PERIODO: "$PERIODO" },
            percepciones: {
              $sum: {
                $cond: [{ $lt: ["$PERCDESC", 500] }, "$IMPORTE", 0]
              }
            },
            deducciones: {
              $sum: {
                $cond: [{ $gte: ["$PERCDESC", 500] }, "$IMPORTE", 0]
              }
            }
          }
        },
        {
          $addFields: {
            neto: { $subtract: ["$percepciones", "$deducciones"] }
          }
        },
        {
          $lookup: {
            from: "mnom01",
            let: { empId: "$_id.EMPLEADO" },
            pipeline: [
              { $match: { $expr: { $eq: ["$EMPLEADO", "$$empId"] } } },
              { $limit: 1 }
            ],
            as: "empleado_info"
          }
        },
        { $unwind: "$empleado_info" },
        {
          $project: {
            _id: 0,
            EMPLEADO: "$_id.EMPLEADO",
            NOMBRE: "$empleado_info.NOMBRE",
            PERIODO: "$_id.PERIODO",
            RESUMEN: {
              PERCEPCIONES: { $round: ["$percepciones", 2] },
              DEDUCCIONES: { $round: ["$deducciones", 2] },
              NETO: { $round: ["$neto", 2] }
            }
          }
        },
        { $sort: { EMPLEADO: 1, PERIODO: -1 } }
      ]).toArray();
    }

    if (tipo === 2) {

      resumen = await db.collection('mnom12h').aggregate([
        {
          $group: {
            _id: { EMPLEADO: "$EMPLEADO", PERIODO: "$PERIODO" },
            percepciones: {
              $sum: {
                $cond: [{ $lt: ["$PERCDESC", 500] }, "$IMPORTE", 0]
              }
            },
            deducciones: {
              $sum: {
                $cond: [{ $gte: ["$PERCDESC", 500] }, "$IMPORTE", 0]
              }
            }
          }
        },
        {
          $addFields: {
            neto: { $subtract: ["$percepciones", "$deducciones"] }
          }
        },
        {
          $lookup: {
            from: "mnom01h",
            let: { empId: "$_id.EMPLEADO" },
            pipeline: [
              { $match: { $expr: { $eq: ["$EMPLEADO", "$$empId"] } } },
              { $limit: 1 }
            ],
            as: "empleado_info"
          }
        },
        { $unwind: "$empleado_info" },
        {
          $project: {
            _id: 0,
            EMPLEADO: "$_id.EMPLEADO",
            NOMBRE: "$empleado_info.NOMBRE",
            PERIODO: "$_id.PERIODO",
            RESUMEN: {
              PERCEPCIONES: { $round: ["$percepciones", 2] },
              DEDUCCIONES: { $round: ["$deducciones", 2] },
              NETO: { $round: ["$neto", 2] }
            }
          }
        },
        { $sort: { EMPLEADO: 1, PERIODO: -1 } }
      ]).toArray();
    }

    res.json(resumen);
  } catch (error) {
    console.error('Error al obtener resumen de nómina:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
