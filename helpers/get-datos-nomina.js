const { getDb } = require('./mongo.helper');
const numeroALetras = require('./numeros-letras');
const formatearFechaTexto = require('./formatear-fecha-texto');

// Utilidad para formatear cantidades
const formatCantidad = (cantidad) => new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(cantidad);

module.exports = async function getDatosNomina(empleado, periodo) {
  const db = getDb();

  const filtroPeriodo = periodo === 0 ? {} : { PERIODO: periodo };
  const conceptosRaw = await db.collection('mnom12').find({ EMPLEADO: empleado, ...filtroPeriodo }).toArray();
  const empleadoData = await db.collection('mnom01').findOne({ EMPLEADO: empleado });
  const deptoData = await db.collection('mnom04').findOne({ DEPTO: empleadoData.DEPTO });
  const puestoData = await db.collection('mnom03').findOne({ CATEGORIA: empleadoData.CAT });
  let prestacionesData = null;
  let sueldoIntegrado = 0;
  if(empleadoData.TIPOEMP === "B") {
    prestacionesData = await db.collection('sueldoprestacionesbase').findOne({ EMPLEADO: empleado });
    if (prestacionesData) {
      sueldoIntegrado = prestacionesData.SUELDOINTEGRADO;
    }
  }
  else {
    prestacionesData = await db.collection('sueldoprestacionesconf').findOne({ EMPLEADO: empleado });
    if (prestacionesData) {
      sueldoIntegrado = prestacionesData.SUELDOINTEGRADO;
    }
  }

  const percepciones = conceptosRaw.filter(c => c.PERCDESC >= 1 && c.PERCDESC < 13);
  const prestaciones = conceptosRaw.filter(c => c.PERCDESC >= 13 && c.PERCDESC < 500);
  const deducciones = conceptosRaw.filter(c => c.PERCDESC >= 500);

  const totalPercepciones = percepciones.reduce((s, c) => s + c.IMPORTE, 0);
  const totalPrestaciones = prestaciones.reduce((s, c) => s + c.IMPORTE, 0);
  const totalDeducciones = deducciones.reduce((s, c) => s + c.IMPORTE, 0);
  const totalNeto = totalPercepciones + totalPrestaciones - totalDeducciones;

  const conceptos = conceptosRaw.map(c => ({
    ...c,
    percepcion: (c.PERCDESC >= 1 && c.PERCDESC < 13) ? formatCantidad(c.IMPORTE) : "",
    prestacion: (c.PERCDESC >= 13 && c.PERCDESC < 500) ? formatCantidad(c.IMPORTE) : "",
    deduccion: (c.PERCDESC >= 500) ? formatCantidad(c.IMPORTE) : ""
  }));

  return {
    empleado: empleadoData,
    periodo,
    departamento: deptoData.DESCRIPCION,
    puesto: puestoData.DESCRIPCION,
    sueldoIntegrado: formatCantidad(sueldoIntegrado),
    fechaPago: `${formatearFechaTexto(conceptosRaw[0]?.FECHDES)} al ${formatearFechaTexto(conceptosRaw[0]?.FECHHAS)}`,
    conceptos,
    totales: {
      percepciones: formatCantidad(totalPercepciones),
      prestaciones: formatCantidad(totalPrestaciones),
      deducciones: formatCantidad(totalDeducciones),
      neto: formatCantidad(totalNeto)
    },
    cantidadLetras: numeroALetras(totalNeto),
  };
};