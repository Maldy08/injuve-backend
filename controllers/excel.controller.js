const XLSX = require('xlsx');
const { getDb } = require('../helpers/mongo.helper');
const formatearFechaTexto = require('../helpers/formatear-fecha-texto');


exports.percepcionesPivotJsonPorPeriodo = async (req, res) => {
  const db = getDb();
  const { periodo } = req.params;
  if (!periodo) {
    return res.status(400).json({ error: "Parámetro periodo inválido" });
  }

  const percepciones = await db.collection('mnom12')
    .find({ PERIODO: Number(periodo), PERCDESC: { $lte: 500 } })
    .project({ EMPLEADO: 1, DIASTRA: 1, PERCDESC: 1, DESCRIPCION: 1, IMPORTE: 1, _id: 0 })
    .sort({ PERCDESC: 1 })
    .toArray();

  const empleadosRFC = await db.collection('mnom01')
    .find({ EMPLEADO: { $in: percepciones.map(p => p.EMPLEADO) } })
    .project({ EMPLEADO: 1, RFC: 1, CURP: 1, _id: 0 })
    .toArray();

  const bssCollection = await db.collection('bss')
    .find()
    .toArray();

  const empleadosMap = {};
  empleadosRFC.forEach(e => {
    empleadosMap[e.EMPLEADO] = { RFC: e.RFC || '', CURP: e.CURP || '' };
  });

  const percepcionesConRFC = percepciones.map(p => ({
    ...p,
    RFC: empleadosMap[p.EMPLEADO]?.RFC || '',
    CURP: empleadosMap[p.EMPLEADO]?.CURP || ''
  }));

  const descripcionesUnicas = [...new Set(percepciones.map(p => p.DESCRIPCION))];
  const bssEmpleadosSet = new Set(bssCollection.map(b => +b.empleado));
  const empleados = {};

  percepcionesConRFC.forEach(p => {
    if (!bssEmpleadosSet.has(p.EMPLEADO)) return;

    if (!empleados[p.EMPLEADO]) {
      empleados[p.EMPLEADO] = {
        EMPLEADO: p.EMPLEADO,
        RFC: p.RFC,
        // Periodos especiales (>=100, ej. retroactivo/aguinaldo) traen DIASTRA ya en días;
        // los periodos quincenales normales lo traen en horas, de ahí la división entre 8.
        DIAS: p.PERCDESC === 1 ? (Number(periodo) >= 100 ? p.DIASTRA : p.DIASTRA / 8) : 0,
        TOTAL_PERCEPCIONES: 0,
      };
    }
    empleados[p.EMPLEADO][p.DESCRIPCION] = p.IMPORTE;
    if (p.PERCDESC < 500) {
      empleados[p.EMPLEADO].TOTAL_PERCEPCIONES += Number(p.IMPORTE || 0);
    }
  });

  // Asegura que todas las percepciones tengan valor 0 si están vacías
  const rows = Object.values(empleados);
  rows.forEach(row => {
    descripcionesUnicas.forEach(desc => {
      if (row[desc] === undefined) {
        row[desc] = 0;
      }
    });
  });

  res.json({
    columns: [
      { header: 'EMPLEADO', key: 'EMPLEADO' },
      { header: 'RFC', key: 'RFC' },
      { header: 'DIAS', key: 'DIAS' },
      ...descripcionesUnicas.map(desc => ({ header: desc, key: desc })),
      { header: 'TOTAL_PERCEPCIONES', key: 'TOTAL_PERCEPCIONES' }
    ],
    data: rows
  });
};

exports.percepcionesPivotPorPeriodo = async (req, res) => {
  const db = getDb();
  const { periodo } = req.params;
  if (!periodo) {
    return res.status(400).json({ error: "Parámetro periodo inválido" });
  }


  const percepciones = await db.collection('mnom12')
    .find({ PERIODO: Number(periodo), PERCDESC: { $lte: 500 } })
    .project({ EMPLEADO: 1, DIASTRA: 1, PERCDESC: 1, DESCRIPCION: 1, IMPORTE: 1, _id: 0 })
    .sort({ PERCDESC: 1 })
    .toArray();


  const empleadosRFC = await db.collection('mnom01')
    .find({ EMPLEADO: { $in: percepciones.map(p => p.EMPLEADO) } })
    .project({ EMPLEADO: 1, RFC: 1, CURP: 1, TIPOEMP: 1, _id: 0 })
    .toArray();


  const bssCollection = await db.collection('bss')
    .find()
    .toArray();

  // SUELDOMES ("sueldo mensual ordinario") vive en sueldoprestacionesbase (TIPOEMP 'B')
  // o sueldoprestacionesconf (el resto); se combinan en un solo mapa por EMPLEADO igual
  // que en generarTimbrado / get-datos-nomina.js.
  const empleadosIds = empleadosRFC.map(e => e.EMPLEADO);
  const prestacionesBaseInfo = await db.collection('sueldoprestacionesbase')
    .find({ EMPLEADO: { $in: empleadosIds } })
    .project({ EMPLEADO: 1, SUELDOMES: 1, _id: 0 }).toArray();
  const prestacionesConfInfo = await db.collection('sueldoprestacionesconf')
    .find({ EMPLEADO: { $in: empleadosIds } })
    .project({ EMPLEADO: 1, SUELDOMES: 1, _id: 0 }).toArray();
  const sueldoMensualMap = {};
  [...prestacionesBaseInfo, ...prestacionesConfInfo].forEach(p => { sueldoMensualMap[p.EMPLEADO] = p; });

  const empleadosMap = {};
  empleadosRFC.forEach(e => {
    empleadosMap[e.EMPLEADO] = { RFC: e.RFC || '', CURP: e.CURP || '' };
  });

  const percepcionesConRFC = percepciones.map(p => ({
    ...p,
    RFC: empleadosMap[p.EMPLEADO]?.RFC || '',
    CURP: empleadosMap[p.EMPLEADO]?.CURP || ''
  }));

  const descripcionesUnicas = [...new Set(percepciones.map(p => p.DESCRIPCION))];
  const bssEmpleadosSet = new Set(bssCollection.map(b => +b.empleado));
  const empleados = {};


  percepcionesConRFC.forEach(p => {
    if (!bssEmpleadosSet.has(p.EMPLEADO)) return;

    if (!empleados[p.EMPLEADO]) {
      empleados[p.EMPLEADO] = {
        EMPLEADO: p.EMPLEADO,
        RFC: p.RFC,
        DIAS: 0,
        DIAS_PRIMA: 0,
        // Sueldo mensual ordinario solo aplica a periodos especiales (>=100, ej.
        // retroactivo/aguinaldo); en periodos quincenales normales queda en 0.
        SUELDO_MENSUAL_ORDINARIO: Number(periodo) >= 100 ? (sueldoMensualMap[p.EMPLEADO]?.SUELDOMES || 0) : 0,
        TOTAL_PERCEPCIONES: 0,
      };
    }
    if (p.PERCDESC === 1) {
      // Periodos especiales (>=100, ej. retroactivo/aguinaldo) traen DIASTRA ya en días;
      // los periodos quincenales normales lo traen en horas, de ahí la división entre 8.
      empleados[p.EMPLEADO].DIAS += Number(periodo) >= 100 ? p.DIASTRA : p.DIASTRA / 8;
    }
    if (p.PERCDESC === 5) {
      empleados[p.EMPLEADO].DIAS_PRIMA += p.DIASTRA; // O solo p.DIASTRA si así lo necesitas
    }
    empleados[p.EMPLEADO][p.DESCRIPCION] = p.IMPORTE;
    if (p.PERCDESC < 500) {
      empleados[p.EMPLEADO].TOTAL_PERCEPCIONES += Number(p.IMPORTE || 0);
    }
  });


  const headers = [
    { header: 'EMPLEADO', key: 'EMPLEADO', width: 10 },
    { header: 'RFC', key: 'RFC', width: 15 },
    { header: 'DIAS', key: 'DIAS', width: 15 },
    { header: 'DIAS_PRIMA', key: 'DIAS_PRIMA', width: 15 },
    { header: 'SUELDO_MENSUAL_ORDINARIO', key: 'SUELDO_MENSUAL_ORDINARIO', width: 20 },
    ...descripcionesUnicas.map(desc => ({ header: desc, key: desc, width: 20 })),
    { header: 'TOTAL_PERCEPCIONES', key: 'TOTAL_PERCEPCIONES', width: 20 }
  ];

  const rows = Object.values(empleados);
  rows.forEach(row => {
    descripcionesUnicas.forEach(desc => {
      if (row[desc] === undefined) {
        row[desc] = 0;
      }
    });
  });


  const XLSX = require('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers.map(h => h.key) });
  XLSX.utils.sheet_add_aoa(ws, [headers.map(h => h.header)], { origin: "A1" });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Percepciones');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const fileName = `BSS_REVISION_PERIODO${periodo}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
};

const NOM_ORD_HEADER = 'ENTIDAD,NOM_FONDO,CLAVE_DEPEN,DEPEN,CCT,CENTRO_TRABAJO,TIPO_NOMINA,PERIODICIDAD_PAGO,RFC,CURP,NSS,NOMBRE_EMP,APELLIDO_1_EMP,APELLIDO_2_EMP,NUM_EMP,PLAZA,TIPO_DE_PERSONAL,CAT_PUESTO,CATEGORIA,DES_PUESTO,NIVEL_SALARIAL,ZE,HORAS,FECHA_ING,ANTIG,N_QUINQ,FECHA_INI,FECHA_FIN,FECHA_PROC,PERIODO_INI,PERIODO_FIN,PERIODO_PROC,DIAS_PAG,TIPO_PAGO,NUM_CHEQUE_TRANSF,NUM_CTA _PAG,CVE_BANCO_PAG,NOM_BANCO_PAG,NUM_CTA_EMP,CVE_BANCO_EMP,NOM_BANCO_EMP,ORIGEN_RECURSO,UUID,T_PERCCHEQ,T_DEDCHEQ,T_NETOCHEQ,PERCEPCION_N,DEDUCCION_N,NUM_POL_EGRE,NUM_POL_PRES,NUM_CLC,ADIC_TEXTO_N';

function csvField(value) {
  const str = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Los campos de fecha en mnom01/mnom12 vienen en DOS formatos distintos según la época
// en que se cargó el periodo (no hay campo AÑO confiable en mnom12 - siempre '0'):
//   - Periodos antiguos: "DD/MM/YYYY" sin hora (ej. periodo 3: "06/02/2026")
//   - Periodos recientes: "MM/DD/YY 00:00:00" (ej. periodo 14: "07/10/26 00:00:00")
// Detectamos el formato por la longitud del año para no invertir día/mes.
function parseFechaSirh(fechaStr) {
  if (!fechaStr) return null;
  const partes = fechaStr.split(' ')[0].split('/');
  if (partes.length !== 3) return null;
  const [a, b, c] = partes;
  let dia, mes, anio;
  if (c.length === 4) {
    dia = a; mes = b; anio = c;
  } else {
    mes = a; dia = b;
    anio = Number(c) >= 50 ? `19${c}` : `20${c}`;
  }
  const date = new Date(Number(anio), Number(mes) - 1, Number(dia));
  return isNaN(date.getTime()) ? null : date;
}

function formatDDMMYYYY(date) {
  if (!date) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

// mnom12 no tiene campo AÑO confiable (siempre '0'), así que el año de cada PERIODO se
// deriva de sus fechas. Un periodo pertenece al ejercicio si su inicio (FECHDES) O su fin
// (FECHHAS) cae en ese año - así no se pierden los periodos que cruzan el límite del año
// (ej. el periodo que empieza el 27/dic/25 y termina el 09/ene/26 debe contar en AMBOS
// ejercicios si se piden). Mismo criterio que usa AgenteNomina/ObtenerPeriodosDelEjercicio
// contra PERCERRADOS, para que agente y backend no se contradigan sobre qué periodo
// pertenece a qué año.
async function obtenerPeriodosDelAnio(db, collectionName, anio) {
  const periodosConFecha = await db.collection(collectionName)
    .aggregate([
      { $group: { _id: '$PERIODO', FECHDES: { $first: '$FECHDES' }, FECHHAS: { $first: '$FECHHAS' } } }
    ]).toArray();

  return periodosConFecha
    .filter(p => {
      const inicioEnAnio = parseFechaSirh(p.FECHDES)?.getFullYear() === Number(anio);
      const finEnAnio = parseFechaSirh(p.FECHHAS)?.getFullYear() === Number(anio);
      return inicioEnAnio || finEnAnio;
    })
    .map(p => p._id);
}

// Arma las 51 columnas de NOM_ORD para un empleado+periodo. `percepcionN`/`deduccionN`
// quedan parametrizados porque generarNomOrd (agregado) los deja vacíos, mientras que
// generarNomOrdDetalle (detalle) los llena con el importe de UN concepto por fila.
function construirFilaNomOrd(emp, item, lookups, totales, percepcionN, deduccionN) {
  const { departamentosInfo, puestosInfo, categoriasInfo, diasPagadosEmpleados } = lookups;

  const fechaAltaDate = parseFechaSirh(emp.FECHAALTA);
  const fechaHastaDate = parseFechaSirh(item.FECHHAS);
  const fechaAlta = formatDDMMYYYY(fechaAltaDate);

  let antig = '';
  if (fechaAltaDate && fechaHastaDate) {
    antig = Math.floor((fechaHastaDate - fechaAltaDate) / (1000 * 60 * 60 * 24 * 365.25));
  }

  const fields = [
    '', // ENTIDAD
    '', // NOM_FONDO
    '', // CLAVE_DEPEN
    departamentosInfo.find(d => d.DEPTO === emp.DEPTO)?.DESCRIPCION || '', // DEPEN
    '', // CCT
    '', // CENTRO_TRABAJO
    1, // TIPO_NOMINA
    14, // PERIODICIDAD_PAGO
    emp.RFC || '', // RFC
    emp.CURP || '', // CURP
    emp.REGIMSS || '', // NSS (ISSSTECALI)
    emp.NOMBRE || '', // NOMBRE_EMP
    emp.APPAT || '', // APELLIDO_1_EMP
    emp.APMAT || '', // APELLIDO_2_EMP
    emp.EMPLEADO, // NUM_EMP
    '', // PLAZA
    emp.TIPOEMP || '', // TIPO_DE_PERSONAL
    emp.CAT || '', // CAT_PUESTO
    categoriasInfo.find(c => c.CATEGORIA === emp.CAT)?.DESCRIPCION || '', // CATEGORIA
    puestosInfo.find(p => p.PUESTO === emp.PUESTO)?.DESCRIPCION || '', // DES_PUESTO
    emp.NIVEL || '', // NIVEL_SALARIAL
    '', // ZE
    '', // HORAS
    fechaAlta, // FECHA_ING
    antig, // ANTIG
    '', // N_QUINQ
    formatDDMMYYYY(parseFechaSirh(item.FECHDES)), // FECHA_INI
    formatDDMMYYYY(fechaHastaDate), // FECHA_FIN
    formatDDMMYYYY(parseFechaSirh(item.FECHAP)), // FECHA_PROC
    item.PERIODO, // PERIODO_INI
    item.PERIODO, // PERIODO_FIN
    item.PERIODO, // PERIODO_PROC
    diasPagadosEmpleados[`${item.EMPLEADO}_${item.PERIODO}`] || 0, // DIAS_PAG
    '', // TIPO_PAGO
    '', // NUM_CHEQUE_TRANSF
    '', // NUM_CTA_PAG
    '', // CVE_BANCO_PAG
    '', // NOM_BANCO_PAG
    emp.CTABANCO || '', // NUM_CTA_EMP
    '', // CVE_BANCO_EMP
    '', // NOM_BANCO_EMP
    '', // ORIGEN_RECURSO
    '', // UUID
    totales.TotalPercepciones.toFixed(2), // T_PERCCHEQ
    totales.TotalDeducciones.toFixed(2), // T_DEDCHEQ
    (totales.TotalPercepciones - totales.TotalDeducciones).toFixed(2), // T_NETOCHEQ
    percepcionN, // PERCEPCION_N
    deduccionN, // DEDUCCION_N
    '', // NUM_POL_EGRE
    '', // NUM_POL_PRES
    '', // NUM_CLC
    '', // ADIC_TEXTO_N
  ];

  return fields.map(csvField).join(',');
}

// Junta lo que generarNomOrd/generarNomOrdDetalle necesitan en común: datos del ejercicio,
// empleados y catálogos (departamentos/puestos/categorías), más los totales T_PERCCHEQ/
// T_DEDCHEQ por empleado+periodo (que ambos reportes muestran igual, agregado o no).
async function prepararDatosNomOrd(db, anio, tipo) {
  const collectionName = tipo == 1 ? 'mnom12' : 'mnom12h';
  const empleadosCollection = tipo == 1 ? 'mnom01' : 'mnom01h';

  const periodosDelAnio = await obtenerPeriodosDelAnio(db, collectionName, anio);
  if (periodosDelAnio.length === 0) return null;

  const data = await db.collection(collectionName)
    .find({ PERIODO: { $in: periodosDelAnio } })
    .sort({ EMPLEADO: 1, PERIODO: 1 })
    .toArray();

  const totalesPorEmpleadoPeriodo = {};
  data.forEach(item => {
    const key = `${item.EMPLEADO}_${item.PERIODO}`;
    if (!totalesPorEmpleadoPeriodo[key]) {
      totalesPorEmpleadoPeriodo[key] = { TotalPercepciones: 0, TotalDeducciones: 0 };
    }
    if (item.PERCDESC < 500) {
      totalesPorEmpleadoPeriodo[key].TotalPercepciones += Number(item.IMPORTE || 0);
    } else {
      totalesPorEmpleadoPeriodo[key].TotalDeducciones += Number(item.IMPORTE || 0);
    }
  });

  const diasPagadosEmpleados = data.reduce((acc, item) => {
    if (item.PERCDESC === 1 || item.PERCDESC === 23) {
      const key = `${item.EMPLEADO}_${item.PERIODO}`;
      // Periodos especiales (>=100, ej. retroactivo/aguinaldo) traen DIASTRA ya en días;
      // los periodos quincenales normales lo traen en horas, de ahí la división entre 8.
      acc[key] = item.PERCDESC === 1
        ? (Number(item.PERIODO) >= 100 ? item.DIASTRA : item.DIASTRA / 8)
        : item.DIASTRA || 0;
    }
    return acc;
  }, {});

  const empleadosIds = [...new Set(data.map(d => d.EMPLEADO))];
  const empleadosInfo = await db.collection(empleadosCollection)
    .find({ EMPLEADO: { $in: empleadosIds } })
    .project({ EMPLEADO: 1, NOMBRE: 1, APPAT: 1, APMAT: 1, RFC: 1, CURP: 1, REGIMSS: 1, DEPTO: 1, CAT: 1, PUESTO: 1, CTABANCO: 1, NIVEL: 1, FECHAALTA: 1, TIPOEMP: 1, _id: 0 })
    .toArray();

  const departamentosInfo = await db.collection('mnom04')
    .find().project({ DEPTO: 1, DESCRIPCION: 1, _id: 0 }).toArray();

  const puestosInfo = await db.collection('mnom90')
    .find().project({ PUESTO: 1, DESCRIPCION: 1, _id: 0 }).toArray();

  const categoriasInfo = await db.collection('mnom03')
    .find().project({ CATEGORIA: 1, DESCRIPCION: 1, _id: 0 }).toArray();

  const empleadosInfoMap = {};
  empleadosInfo.forEach(e => { empleadosInfoMap[e.EMPLEADO] = e; });

  return {
    data,
    totalesPorEmpleadoPeriodo,
    empleadosInfoMap,
    lookups: { departamentosInfo, puestosInfo, categoriasInfo, diasPagadosEmpleados },
  };
}

// Genera el CSV de "Nómina Ordinaria" en el formato homologado (NOM_ORD) para TODOS los
// periodos de un año/ejercicio. Cada fila es un empleado x periodo (un empleado con
// 24-26 periodos pagados en el año aparece 24-26 veces). Campos sin fuente en el sistema
// (ENTIDAD, NOM_FONDO, CLAVE_DEPEN, CCT, CENTRO_TRABAJO, ZE, HORAS, PLAZA, N_QUINQ, banco
// de pago, UUID, pólizas contables, PERCEPCION_N/DEDUCCION_N) se dejan vacíos porque no
// existen catálogos equivalentes en mnom01/mnom04/mnom90/mnom12.
exports.generarNomOrd = async (req, res) => {
  const db = getDb();
  const { anio, tipo } = req.params;
  if (!anio || !tipo) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  const datos = await prepararDatosNomOrd(db, anio, tipo);
  if (!datos) {
    return res.status(404).json({ error: `No hay periodos con datos para el ejercicio ${anio}` });
  }
  const { data, totalesPorEmpleadoPeriodo, empleadosInfoMap, lookups } = datos;

  const vistos = new Set();
  const rows = [];
  data.forEach(item => {
    const key = `${item.EMPLEADO}_${item.PERIODO}`;
    if (vistos.has(key)) return;
    vistos.add(key);

    const emp = empleadosInfoMap[item.EMPLEADO] || {};
    const totales = totalesPorEmpleadoPeriodo[key];
    rows.push(construirFilaNomOrd(emp, item, lookups, totales, '', ''));
  });

  const csv = '﻿' + NOM_ORD_HEADER + '\n' + rows.join('\n') + '\n';
  const fileName = `NOM_ORD_${anio}_${tipo}.csv`;
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(csv);
};

// Mismo formato de 51 columnas que NOM_ORD, mismo alcance (todos los periodos de un
// ejercicio), pero SIN agrupar: una fila por CADA concepto de percepción/deducción tal
// como viene en mnom12/mnom12h. PERCEPCION_N lleva el importe si el concepto es percepción
// (PERCDESC<500) y DEDUCCION_N si es deducción, dejando el otro vacío en esa fila.
// T_PERCCHEQ/T_DEDCHEQ/T_NETOCHEQ siguen siendo el total del periodo (se repiten en cada
// fila del mismo empleado+periodo) para poder cuadrar el detalle contra el total.
// Ojo: el formato NOM_ORD no tiene columna de clave/descripción de concepto, así que estas
// filas de detalle no identifican DE QUÉ concepto es cada importe, solo el monto y si es
// percepción o deducción.
exports.generarNomOrdDetalle = async (req, res) => {
  const db = getDb();
  const { anio, tipo } = req.params;
  if (!anio || !tipo) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  const datos = await prepararDatosNomOrd(db, anio, tipo);
  if (!datos) {
    return res.status(404).json({ error: `No hay periodos con datos para el ejercicio ${anio}` });
  }
  const { data, totalesPorEmpleadoPeriodo, empleadosInfoMap, lookups } = datos;

  const rows = data.map(item => {
    const key = `${item.EMPLEADO}_${item.PERIODO}`;
    const emp = empleadosInfoMap[item.EMPLEADO] || {};
    const totales = totalesPorEmpleadoPeriodo[key];
    const importe = Number(item.IMPORTE || 0).toFixed(2);
    const esPercepcion = item.PERCDESC < 500;

    return construirFilaNomOrd(emp, item, lookups, totales, esPercepcion ? importe : '', esPercepcion ? '' : importe);
  });

  const csv = '﻿' + NOM_ORD_HEADER + '\n' + rows.join('\n') + '\n';
  const fileName = `NOM_ORD_DETALLE_${anio}_${tipo}.csv`;
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(csv);
};

exports.generarTimbrado = async (req, res) => {
  const db = getDb();
  const { periodo, tipo } = req.params;
  if (!periodo || !tipo) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  const collectionName = tipo == 1 ? 'mnom12' : 'mnom12h';
  const empleadosCollection = tipo == 1 ? 'mnom01' : 'mnom01h';
  const sueldoPrestacionesBaseCollection = 'sueldoprestacionesbase';
  const sueldoPrestacionesConfCollection = 'sueldoprestacionesconf';
  const departamentosCollection = 'mnom04';
  const puestosCollection = 'mnom90';

  const data = await db.collection(collectionName)
    .find({ PERIODO: Number(periodo) })
    .sort({ EMPLEADO: 1 })
    .toArray();


  const diasPagadosEmpleados = data.reduce((acc, item) => {
    const percepcion = item.PERCDESC;
    if (percepcion === 1 || percepcion === 23) {
      const empleado = item.EMPLEADO;

      // Periodos especiales (>=100, ej. retroactivo/aguinaldo) traen DIASTRA ya en días;
      // los periodos quincenales normales lo traen en horas, de ahí la división entre 8.
      acc[empleado] = percepcion === 1
        ? (Number(periodo) >= 100 ? item.DIASTRA : item.DIASTRA / 8)
        : item.DIASTRA || 0;
    }
    return acc;
  }, {});



  const fechaHasta = formatearFechaTexto(data[0]?.FECHHAS);

  const empleados = {};
  data.forEach(item => {
    const emp = item.EMPLEADO;
    if (!empleados[emp]) {
      empleados[emp] = {
        ...item,
        TotalPercepciones: 0,
        TotalDeducciones: 0
      };
    }
    if (item.PERCDESC < 500) {
      empleados[emp].TotalPercepciones += Number(item.IMPORTE || 0);
    } else {
      empleados[emp].TotalDeducciones += Number(item.IMPORTE || 0);
    }
  });


  const empleadosIds = Object.keys(empleados).map(Number);
  const empleadosInfo = await db.collection(empleadosCollection)
    .find({ EMPLEADO: { $in: empleadosIds } })
    .project({ EMPLEADO: 1, NOMBRE: 1, APPAT:1, APMAT:1, RFC: 1, CURP: 1, REGIMSS: 1, DEPTO: 1, CAT: 1, PUESTO: 1, CTABANCO: 1, NIVEL: 1, FECHAALTA: 1, TIPOEMP: 1, _id: 0 })
    .toArray();


  const prestacionesBase = await db.collection(sueldoPrestacionesBaseCollection)
    .find({ EMPLEADO: { $in: empleadosIds } })
    .project({ EMPLEADO: 1, SUELDOINTEGRADO: 1, _id: 0 })
    .toArray();

  const prestacionesConf = await db.collection(sueldoPrestacionesConfCollection)
    .find({ EMPLEADO: { $in: empleadosIds } })
    .project({ EMPLEADO: 1, SUELDOINTEGRADO: 1, _id: 0 })
    .toArray();

  const departamentosInfo = await db.collection(departamentosCollection)
    .find()
    .project({ DEPTO: 1, DESCRIPCION: 1, _id: 0 })
    .toArray();

  const puestosInfo = await db.collection(puestosCollection)
    .find()
    .project({ PUESTO: 1, DESCRIPCION: 1, _id: 0 })
    .toArray();

  const percepcionesInfo = await db.collection(collectionName)
    .find({ PERIODO: Number(periodo), PERCDESC: { $lt: 500 } })
    .project({ EMPLEADO: 1, PERCDESC: 1, DESCRIPCION: 1, IMPORTE: 1, _id: 0 })
    .sort({ EMPLEADO: 1 })
    .toArray();


  const deduccionesInfo = await db.collection(collectionName)
    .find({ PERIODO: Number(periodo), PERCDESC: { $gte: 500 } })
    .project({ EMPLEADO: 1, PERCDESC: 1, DESCRIPCION: 1, IMPORTE: 1, _id: 0 })
    .sort({ EMPLEADO: 1 })
    .toArray();


  const conversiones_percdesc_sat = await db.collection('conversiones_percdesc_sat')
    .find()
    .toArray();


  const infoMap = {};
  empleadosInfo.forEach(e => {
    infoMap[e.EMPLEADO] = { RFC: e.RFC || '', CURP: e.CURP || '' };
  });


  const headers = [
    { header: 'RFC', key: 'RFC', width: 15 },
    { header: 'CURP', key: 'CURP', width: 15 },
    { header: 'FechaPago', key: 'FECHAP', width: 15 },
    { header: 'FechaInicialPago', key: 'FECHDES', width: 15 },
    { header: 'FechaFinalPago', key: 'FECHHAS', width: 15 },
    { header: 'NumDiasPagados', key: 'DIASTRA', width: 10 },
    { header: 'TotalPercepciones', key: 'TotalPercepciones', width: 15 },
    { header: 'TotalDeducciones', key: 'TotalDeducciones', width: 15 },
    { header: 'TotalOtrosPagos', key: 'TotalOtrosPagos', width: 15 },
    { header: 'NumEmpleado', key: 'EMPLEADO', width: 10 },
  ];


  const nomnaRows = Object.values(empleados).map((item, idx) => ({
    RFC: infoMap[item.EMPLEADO]?.RFC || '',
    CURP: infoMap[item.EMPLEADO]?.CURP || '',
    FECHAP: formatearFechaTexto(item.FECHAP),
    FECHDES: formatearFechaTexto(item.FECHDES),
    FECHHAS: formatearFechaTexto(item.FECHHAS),
    DIASTRA: diasPagadosEmpleados[item.EMPLEADO] || 0,
    TotalPercepciones: item.TotalPercepciones,
    TotalDeducciones: item.TotalDeducciones,
    TotalOtrosPagos: 0,
    EMPLEADO: item.EMPLEADO
  }));


  const emisorHeaders = [
    { header: 'CURPEMPLEADO', key: 'CURPEMPLEADO', width: 15 },
    { header: 'RegisgtroPatronal', key: 'RFCPATRON', width: 15 },
    { header: 'Curp', key: 'CURP', width: 15 },
    { header: 'RfcPatronorigen', key: 'RFC', width: 15 },
    { header: 'NumEmpleado', key: 'EMPLEADO', width: 10 }
  ]

  const emisorRows = empleadosInfo.map(row => ({
    CURPEMPLEADO: row.CURP,
    RFCPATRON: 'IJE110711724',
    CURP: '',
    RFC: 'IJE110711724',
    EMPLEADO: row.EMPLEADO
  }));

  const receptorHeaders = [
    { header: 'Curp', key: 'CURP', width: 15 },
    { header: 'NumSeguridadSocial', key: 'NumSeguridadSocial', width: 15 },
    { header: 'FechaInicioRelLaboral', key: 'FechaInicioRelLaboral', width: 15 },
    { header: 'Antiguedad', key: 'Antiguedad', width: 12 },
    { header: 'TipoContrato', key: 'TipoContrato', width: 12 },
    { header: 'Sindicalizado', key: 'Sindicalizado', width: 12 },
    { header: 'TipoJornada', key: 'TipoJornada', width: 12 },
    { header: 'TipoRegimen', key: 'TipoRegimen', width: 12 },
    { header: 'NumEmpleado', key: 'NumEmpleado', width: 12 },
    { header: 'Departamento', key: 'Departamento', width: 15 },
    { header: 'Puesto', key: 'Puesto', width: 15 },
    { header: 'RiesgoPuesto', key: 'RiesgoPuesto', width: 15 },
    { header: 'PeriodicidadPago', key: 'PeriodicidadPago', width: 15 },
    { header: 'Banco', key: 'Banco', width: 15 },
    { header: 'CuentaBancaria', key: 'CuentaBancaria', width: 15 },
    { header: 'SalarioBaseCotApor', key: 'SalarioBaseCotApor', width: 18 },
    { header: 'SalarioDiarioIntegrado', key: 'SalarioDiarioIntegrado', width: 18 },
    { header: 'ClaveEntFed', key: 'ClaveEntFed', width: 12 },
    { header: 'NnumEmpleado', key: 'NnumEmpleado', width: 12 }
  ];

  //antiguedad = diferentecia entre  mnom01.fechaalta y mnom12.fechahas
  const [diaH, mesH, anioH] = fechaHasta.split(' ')[0].split('/');
  const fechaHastaDate = new Date(`${anioH}-${mesH}-${diaH}`);

  const receptorRows = empleadosInfo.map(row => {
    const [dia, mes, anio] = row.FECHAALTA.split(' ')[0].split('/');
    const fechaAlta = new Date(`${anio}-${mes}-${dia}`);
    return {
      CURP: row.CURP,
      NumSeguridadSocial: row.REGIMSS,
      FechaInicioRelLaboral: formatearFechaTexto(row.FECHAALTA),
      Antiguedad: ' P' + Math.floor((fechaHastaDate - fechaAlta) / (1000 * 60 * 60 * 24 * 7)) + 'W',
      TipoContrato: 1,
      Sindicalizado: row.TIPOEMP === 'B' ? 'SI' : 'NO',
      TipoJornada: 1,
      TipoRegimen: 2,
      NumEmpleado: row.EMPLEADO,
      Departamento: departamentosInfo.find(d => d.DEPTO === row.DEPTO)?.DESCRIPCION || 'UNICO',
      Puesto: puestosInfo.find(p => p.PUESTO === row.PUESTO)?.DESCRIPCION || 'UNICO',
      RiesgoPuesto: 1,
      PeriodicidadPago: 3,
      Banco: 12,
      CuentaBancaria: String(row.CTABANCO),
      SalarioBaseCotApor: 0,
      SalarioDiarioIntegrado: row.TIPOEMP === 'B'
        ? +((prestacionesBase.find(p => p.EMPLEADO === row.EMPLEADO)?.SUELDOINTEGRADO || 0) / 14).toFixed(2)
        : +((prestacionesConf.find(p => p.EMPLEADO === row.EMPLEADO)?.SUELDOINTEGRADO || 0) / 14).toFixed(2),
      ClaveEntFed: 'BCN',
      NnumEmpleado: row.EMPLEADO
    };
  });


  const entidadHeaders = [
    { header: 'CURP', key: 'CURP', width: 15 },
    { header: 'MontoRecursoPropio', key: 'MontoRecursoPropio', width: 15 },
    { header: 'OrigenRecurso', key: 'OrigenRecurso', width: 15 },
  ];

  const entidadRows = empleadosInfo.map(row => ({
    CURP: row.CURP,
    MontoRecursoPropio: '',
    OrigenRecurso: 'IP'
  }));


  const subcontratacionHeaders = [
    { header: 'CURP', key: 'CURP', width: 15 },
    { header: 'RfcLaboral', key: 'RfcLaboral', width: 15 },
    { header: 'PorcentajeTiempo', key: 'PorcentajeTiempo', width: 15 },
    { header: 'NumEmpeado', key: 'NumEmpeado', width: 15 }
  ];


  const subcontratacionRows = empleadosInfo.map(row => ({
    CURP: '',
    RfcLaboral: '',
    PorcentajeTiempo: '',
    NumEmpeado: row.EMPLEADO
  }));


  const conceptosHeaders = [
    { header: 'CURP', key: 'CURP', width: 15 },
    { header: 'RFC', key: 'RFC', width: 15 },
    { header: 'Nombre', key: 'Nombre', width: 15 },
    { header: 'Concepto', key: 'Concepto', width: 15 },
    { header: 'Cantidad', key: 'Cantidad', width: 15 },
    { header: 'Unidad', key: 'Unidad', width: 15 },
    { header: 'ValorUnitario', key: 'ValorUnitario', width: 15 },
    { header: 'Importe', key: 'Importe', width: 15 },
    { header: 'NumEmpleado', key: 'NumEmpleado', width: 15 }
  ];

  const conceptosRows = empleadosInfo.map(row => ({
    CURP: row.CURP,
    RFC: row.RFC,
    Nombre: row.NOMBRE + ' ' + row.APPAT + ' ' + row.APMAT,
    Concepto: 'Pago de nómina',
    Cantidad: 1,
    Unidad: 'ACT',
    ValorUnitario: empleados[row.EMPLEADO].TotalPercepciones,
    Importe: empleados[row.EMPLEADO].TotalPercepciones,
    NumEmpleado: row.EMPLEADO
  }));


  const percepcionesHeaders = [
    { header: 'CURP', key: 'CURP', width: 15 },
    { header: 'TotalSueldos', key: 'TotalSueldos', width: 15 },
    { header: 'TotalSeparacionIndemnizacion', key: 'TotalSeparacionIndemnizacion', width: 15 },
    { header: 'TotalJubilacionPensionRetiro', key: 'TotalJubilacionPensionRetiro', width: 15 },
    { header: 'TotalGravado', key: 'TotalGravado', width: 15 },
    { header: 'TotalExento', key: 'TotalExento', width: 15 },
    { header: 'TipoPercepcion', key: 'TipoPercepcion', width: 15 },
    { header: 'Clave', key: 'Clave', width: 15 },
    { header: 'Concepto', key: 'Concepto', width: 15 },
    { header: 'ImporteGravado', key: 'ImporteGravado', width: 15 },
    { header: 'ImporteExento', key: 'ImporteExento', width: 15 },
    { header: 'NumEmpleado', key: 'NumEmpleado', width: 15 }
  ];

  let empleadosProcesados = new Set();
  let percepcionesRows = [];

  percepcionesInfo.forEach(item => {

    if (!empleadosProcesados.has(item.EMPLEADO)) {

      const totalGravado = percepcionesInfo
        .filter(p => p.EMPLEADO === item.EMPLEADO && p.IMPORTE > 0 && p.PERCDESC < 500)
        .reduce((sum, p) => sum + Number(p.IMPORTE || 0), 0);


      const empleado = empleadosInfo.find(e => e.EMPLEADO === item.EMPLEADO) || {};

      percepcionesRows.push({
        CURP: empleado.CURP || '',
        TotalSueldos: totalGravado,
        TotalSeparacionIndemnizacion: 0,
        TotalJubilacionPensionRetiro: 0,
        TotalGravado: totalGravado,
        TotalExento: 0,
        TipoPercepcion: '',
        Clave: '',
        Concepto: '',
        ImporteGravado: '',
        ImporteExento: '',
        NumEmpleado: item.EMPLEADO
      });

      empleadosProcesados.add(item.EMPLEADO);
    }

    if (item.IMPORTE > 0) {
      const empleado = empleadosInfo.find(e => e.EMPLEADO === item.EMPLEADO) || {};
      percepcionesRows.push({
        CURP: empleado.CURP || '',
        TotalSueldos: '',
        TotalSeparacionIndemnizacion: '',
        TotalJubilacionPensionRetiro: '',
        TotalGravado: '',
        TotalExento: '',
        TipoPercepcion: conversiones_percdesc_sat.find(c => c.PERCDESC === item.PERCDESC && c.TIPO === 1)?.CLAVESAT || '',
        Clave: item.DESCRIPCION.substring(0, 6),
        Concepto: conversiones_percdesc_sat.find(c => c.PERCDESC === item.PERCDESC && c.TIPO === 1)?.DESCRIPCIONSAT || '',
        ImporteGravado: item.IMPORTE,
        ImporteExento: 0,
        NumEmpleado: item.EMPLEADO
      });
    }
  });

  empleadosProcesados = new Set();

  const deduccionesHeaders = [
    { header: 'CURP', key: 'CURP', width: 15 },
    { header: 'TotalImpuestosRetenidos', key: 'TotalImpuestosRetenidos', width: 15 },
    { header: 'TotalOtrasDeducciones', key: 'TotalOtrasDeducciones', width: 15 },
    { header: 'TipoDeduccion', key: 'TipoDeduccion', width: 15 },
    { header: 'Clave', key: 'Clave', width: 15 },
    { header: 'Concepto', key: 'Concepto', width: 15 },
    { header: 'Importe', key: 'Importe', width: 15 },
    { header: 'NumEmpleado', key: 'NumEmpleado', width: 15 }
  ];


  let deduccionesRows = [];
  deduccionesInfo.forEach(item => {

    if (!empleadosProcesados.has(item.EMPLEADO)) {

      const totalDeducciones = deduccionesInfo
        .filter(p => p.EMPLEADO === item.EMPLEADO && p.IMPORTE > 0 && p.PERCDESC >= 500)
        .reduce((sum, p) => sum + Number(p.IMPORTE || 0), 0);


      const empleado = empleadosInfo.find(e => e.EMPLEADO === item.EMPLEADO) || {};

      deduccionesRows.push({
        CURP: empleado.CURP || '',
        TotalImpuestosRetenidos: totalDeducciones,
        TotalOtrasDeducciones: 0,
        TipoDeduccion: '',
        Clave: '',
        Concepto: '',
        Importe: '',
        NumEmpleado: item.EMPLEADO
      });

      empleadosProcesados.add(item.EMPLEADO);
    }


    if (item.IMPORTE > 0) {
      const empleado = empleadosInfo.find(e => e.EMPLEADO === item.EMPLEADO) || {};
      deduccionesRows.push({
        CURP: empleado.CURP || '',
        TotalImpuestosRetenidos: '',
        TotalOtrasDeducciones: '',
        TipoDeduccion: conversiones_percdesc_sat.find(c => c.PERCDESC === item.PERCDESC && c.TIPO === 2)?.CLAVESAT || '',
        Clave: item.DESCRIPCION.substring(0, 6),
        Concepto: conversiones_percdesc_sat.find(c => c.PERCDESC === item.PERCDESC && c.TIPO === 2)?.DESCRIPCIONSAT || '',
        Importe: Math.abs(item.IMPORTE),
        NumEmpleado: item.EMPLEADO
      });
    }
  });

  const ws = XLSX.utils.json_to_sheet(nomnaRows.sort((a, b) => a.EMPLEADO - b.EMPLEADO));
  XLSX.utils.sheet_add_aoa(ws, [headers.map(h => h.header)], { origin: "A1" });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nomina');

  const wsEmisor = XLSX.utils.json_to_sheet(emisorRows.sort((a, b) => a.EMPLEADO - b.EMPLEADO));
  XLSX.utils.sheet_add_aoa(wsEmisor, [emisorHeaders.map(h => h.header)], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsEmisor, 'Emisor');

  const wsReceptor = XLSX.utils.json_to_sheet(receptorRows.sort((a, b) => a.EMPLEADO - b.EMPLEADO));
  XLSX.utils.sheet_add_aoa(wsReceptor, [receptorHeaders.map(h => h.header)], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsReceptor, 'Receptor');

  const wsEntidad = XLSX.utils.json_to_sheet(entidadRows);
  XLSX.utils.sheet_add_aoa(wsEntidad, [entidadHeaders.map(h => h.header)], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsEntidad, 'EntidadSNCF');

  const wsSubcontratacion = XLSX.utils.json_to_sheet(subcontratacionRows.sort((a, b) => a.EMPLEADO - b.EMPLEADO));
  XLSX.utils.sheet_add_aoa(wsSubcontratacion, [subcontratacionHeaders.map(h => h.header)], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsSubcontratacion, 'Subcontratacion');

  const wsConceptos = XLSX.utils.json_to_sheet(conceptosRows.sort((a, b) => a.EMPLEADO - b.EMPLEADO));
  XLSX.utils.sheet_add_aoa(wsConceptos, [conceptosHeaders.map(h => h.header)], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsConceptos, 'Conceptos');

  const wsPercepciones = XLSX.utils.json_to_sheet(percepcionesRows.sort((a, b) => a.EMPLEADO - b.EMPLEADO));
  XLSX.utils.sheet_add_aoa(wsPercepciones, [percepcionesHeaders.map(h => h.header)], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsPercepciones, 'Percepciones');

  const wsDeducciones = XLSX.utils.json_to_sheet(deduccionesRows.sort((a, b) => a.EMPLEADO - b.EMPLEADO));
  XLSX.utils.sheet_add_aoa(wsDeducciones, [deduccionesHeaders.map(h => h.header)], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsDeducciones, 'Deducciones');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const fileName = `TIMBRADO_PERIODO_${periodo}_${tipo}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
};