const { getDb } = require('../helpers/mongo.helper');
const formatearFechaTexto = require('../helpers/formatear-fecha-texto');
const numeroALetras = require('../helpers/numeros-letras');

// GET /api/nomina/recibos/:empleado
exports.obtenerResumen = async (req, res) => {
  const empleado = parseInt(req.params.empleado);
  if (isNaN(empleado)) {
    return res.status(400).json({ error: "Empleado inválido" });
  }

  try {
    const db = getDb();
    const conceptosRaw = await db.collection('mnom12').find({ EMPLEADO: empleado }).toArray();

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

  if (isNaN(empleado) || isNaN(periodo)) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  try {
    const db = getDb();
    const filtroPeriodo = periodo === 0 ? {} : { PERIODO: periodo };

    const conceptosRaw = await db.collection('mnom12').find({ EMPLEADO: empleado, ...filtroPeriodo }).toArray();
    const empleadoData = await db.collection('mnom01').findOne({ EMPLEADO: empleado });

    const percepciones = conceptosRaw.filter(c => c.PERCDESC >= 1 && c.PERCDESC < 13);
    const prestaciones = conceptosRaw.filter(c => c.PERCDESC >= 13 && c.PERCDESC < 500);
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
