const { getDb } = require('./mongo.helper');
const numeroALetras = require('./numeros-letras');
const formatearFechaTexto = require('./formatear-fecha-texto');

module.exports = async function getDatosNomina(empleado, periodo) {
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

  return {
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
  };
};
