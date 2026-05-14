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

  if (tipo == 2) {
    await db.collection('mnom12h').updateMany(
      { PERCDESC: 23 }, // Filtro: documentos donde PERCDESC sea igual a 23
      { $set: { DESCRIPCION: "PRESTADOR DE SERVICIOS" } } // Actualización: establecer DESCRIPCION
    );
    await db.collection('mnom12h').updateMany(
      { PERCDESC: 500 }, // Filtro: documentos donde PERCDESC sea igual a 23
      { $set: { DESCRIPCION: "ISR" } } // Actualización: establecer DESCRIPCION
    );
  }

  const coleccionEmpleado = tipo == 1 ? 'mnom01' : 'mnom01h';
  const coleccionNomina = tipo == 1 ? 'mnom12' : 'mnom12h';

  const filtroPeriodo = periodo === 0 ? {} : { PERIODO: periodo };
  const conceptosRaw = await db.collection(coleccionNomina).find({ EMPLEADO: empleado, ...filtroPeriodo }).toArray();
  const empleadoData = await db.collection(coleccionEmpleado).findOne({ EMPLEADO: empleado });

  if (!empleadoData) {
    throw new Error(`Empleado ${empleado} no existe en la colección "${coleccionEmpleado}". Sincroniza el catálogo de empleados con el AgenteNomina (Zona 1 o 2).`);
  }

  if (conceptosRaw.length === 0) {
    const detallePeriodo = periodo === 0 ? "" : ` en el periodo ${periodo}`;
    throw new Error(`No hay registros de nómina para el empleado ${empleado}${detallePeriodo} en la colección "${coleccionNomina}". Verifica que la nómina esté sincronizada con el AgenteNomina.`);
  }

  const deptoData = tipo == 1 ? await db.collection('mnom04').findOne({ DEPTO: empleadoData.DEPTO }) : null;
  if (tipo == 1 && !deptoData) {
    throw new Error(`Departamento ${empleadoData.DEPTO} (asignado al empleado ${empleado}) no existe en la colección "mnom04". Sincroniza el catálogo de departamentos con el AgenteNomina (Zona 3).`);
  }

  const puestoData = tipo == 1 ? await db.collection('mnom03').findOne({ CATEGORIA: empleadoData.CAT }) : null;
  if (tipo == 1 && !puestoData) {
    throw new Error(`Categoría ${empleadoData.CAT} (asignada al empleado ${empleado}) no existe en la colección "mnom03". Sincroniza el catálogo de categorías con el AgenteNomina (Zona 3).`);
  }

  let prestacionesData = null;
  let sueldoIntegrado = 0;
  if (tipo == 1) {
    const coleccionPrestaciones = empleadoData.TIPOEMP === "B" ? 'sueldoprestacionesbase' : 'sueldoprestacionesconf';
    prestacionesData = await db.collection(coleccionPrestaciones).findOne({ EMPLEADO: empleado });
    if (prestacionesData) {
      sueldoIntegrado = prestacionesData.SUELDOINTEGRADO;
    }
  }
  //

  conceptosRaw.sort((a, b) => a.PERCDESC - b.PERCDESC);

  const percepciones = tipo == 1
    ? conceptosRaw.filter(c => (c.PERCDESC >= 1 && c.PERCDESC < 13) || c.PERCDESC === 40 || c.PERCDESC === 60)
    : conceptosRaw.filter(c => (c.PERCDESC >= 1 && c.PERCDESC < 24) || c.PERCDESC === 40 || c.PERCDESC === 60);
  const prestaciones = tipo == 1
    ? conceptosRaw.filter(c => c.PERCDESC >= 13 && c.PERCDESC < 500 && c.PERCDESC !== 40 && c.PERCDESC !== 60)
    : conceptosRaw.filter(c => c.PERCDESC >= 24 && c.PERCDESC < 500 && c.PERCDESC !== 40 && c.PERCDESC !== 60);
  const deducciones = conceptosRaw.filter(c => c.PERCDESC >= 500 && c.PERCDESC !== 570);
  const dias = percepciones.reduce((s, c) => s + (c.PERCDESC == 1 ? c.DIASTRA / 8 : 0), 0);
  const sueldoDiario = sueldoIntegrado / dias;

  const totalPercepciones = percepciones.reduce((s, c) => s + c.IMPORTE, 0);
  const totalPrestaciones = prestaciones.reduce((s, c) => s + c.IMPORTE, 0);
  const totalDeducciones = deducciones.reduce((s, c) => s + c.IMPORTE, 0);
  const totalNeto = totalPercepciones + totalPrestaciones - totalDeducciones;

  const conceptos = conceptosRaw.map(c => ({
    ...c,

    DIASTRA: c.PERCDESC == 1 ? c.DIASTRA / 8 : (c.PERCDESC == 23 || c.PERCDESC == 6 || c.PERCDESC == 60) ? c.DIASTRA : "",
    percepcion: ((tipo == 1 && c.PERCDESC >= 1 && c.PERCDESC < 13) || (tipo != 1 && c.PERCDESC >= 1 && c.PERCDESC < 24) || c.PERCDESC === 40 || c.PERCDESC === 60)
      ? formatCantidad(c.IMPORTE) : "",
    prestacion: ((tipo == 1 && c.PERCDESC >= 13 && c.PERCDESC < 500 && c.PERCDESC !== 40 && c.PERCDESC !== 60) || (tipo != 1 && c.PERCDESC >= 24 && c.PERCDESC < 500 && c.PERCDESC !== 40 && c.PERCDESC !== 60))
      ? formatCantidad(c.IMPORTE) : "",
    deduccion: (c.PERCDESC >= 500) ? formatCantidad(c.IMPORTE) : ""
  }));


  if (empleadoData.TIPOEMP === "C" && tipo == 1) {
    if (!prestacionesData) {
      throw new Error(`Empleado ${empleado} (TIPOEMP="C", confianza) no existe en la colección "sueldoprestacionesconf". Sincroniza el catálogo con el AgenteNomina (Zona 3).`);
    }
    empleadoData.SUELDO = (prestacionesData.SUELDOMES * 12 / 26) / 14
  }

  empleadoData.SUELDO = (empleadoData.SUELDO).toFixed(2);

  return {
    empleado: empleadoData,
    dias: dias,
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