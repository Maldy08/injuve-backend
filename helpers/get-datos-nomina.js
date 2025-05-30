const { getDb } = require('./mongo.helper');
const numeroALetras = require('./numeros-letras');
const formatearFechaTexto = require('./formatear-fecha-texto');

// Utilidad para formatear cantidades
const formatCantidad = (cantidad) => new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(cantidad);

module.exports = async function getDatosNomina(empleado, periodo, tipo) {
  const db = getDb();
  console.log("Obteniendo datos de nómina para el empleado:", empleado, "y periodo:", periodo, "tipo:", tipo);

  if(tipo == 2 ) {
    await db.collection('mnom12h').updateMany(
      { PERCDESC: 23 }, // Filtro: documentos donde PERCDESC sea igual a 23
      { $set: { DESCRIPCION: "PRESTADOR DE SERVICIOS" } } // Actualización: establecer DESCRIPCION
    );
    await db.collection('mnom12h').updateMany(
      { PERCDESC: 500 }, // Filtro: documentos donde PERCDESC sea igual a 23
      { $set: { DESCRIPCION: "ISR" } } // Actualización: establecer DESCRIPCION
    );
  }

  const filtroPeriodo = periodo === 0 ? {} : { PERIODO: periodo };
  const conceptosRaw = tipo == 1 ? await db.collection('mnom12').find({ EMPLEADO: empleado, ...filtroPeriodo }).toArray()
    : await db.collection('mnom12h').find({ EMPLEADO: empleado, ...filtroPeriodo }).toArray();
  const empleadoData = tipo == 1 ? await db.collection('mnom01').findOne({ EMPLEADO: empleado })
    : await db.collection('mnom01h').findOne({ EMPLEADO: empleado });

  const deptoData = tipo == 1 ? await db.collection('mnom04').findOne({ DEPTO: empleadoData.DEPTO }) : null;
  const puestoData = tipo == 1 ? await db.collection('mnom03').findOne({ CATEGORIA: empleadoData.CAT }) : null;
  let prestacionesData = null;
  let sueldoIntegrado = 0;
  if (tipo == 1) {
    if (empleadoData.TIPOEMP === "B") {
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
  }

  conceptosRaw.sort((a, b) => a.PERCDESC - b.PERCDESC);

  const percepciones =  tipo == 1 ? conceptosRaw.filter(c => c.PERCDESC >= 1 && c.PERCDESC < 13) : conceptosRaw.filter(c => c.PERCDESC >= 1 && c.PERCDESC < 24);
  const prestaciones =  tipo == 1 ? conceptosRaw.filter(c => c.PERCDESC >= 13 && c.PERCDESC < 500) : conceptosRaw.filter(c => c.PERCDESC >= 24 && c.PERCDESC < 500);
  const deducciones = conceptosRaw.filter(c => c.PERCDESC >= 500);

  const totalPercepciones = percepciones.reduce((s, c) => s + c.IMPORTE, 0);
  const totalPrestaciones = prestaciones.reduce((s, c) => s + c.IMPORTE, 0);
  const totalDeducciones = deducciones.reduce((s, c) => s + c.IMPORTE, 0);
  const totalNeto = totalPercepciones + totalPrestaciones - totalDeducciones;

  const conceptos = conceptosRaw.map(c => ({
    ...c,
    
    DIASTRA: c.PERCDESC == 1 ? c.DIASTRA / 8 : c.PERCDESC == 23 ? c.DIASTRA : "",
    percepcion: (c.PERCDESC >= 1 && c.PERCDESC < 13) ? formatCantidad(c.IMPORTE) : "",
    prestacion: (c.PERCDESC >= 13 && c.PERCDESC < 500) ? formatCantidad(c.IMPORTE) : "",
    deduccion: (c.PERCDESC >= 500) ? formatCantidad(c.IMPORTE) : ""
  }));

  return {
    empleado: empleadoData,
    dias: 12,
    periodo,
    departamento: tipo == 1 ? deptoData.DESCRIPCION : "",
    puesto: tipo == 1 ? puestoData.DESCRIPCION : "",
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