const XLSX = require('xlsx');
const { getDb } = require('../helpers/mongo.helper');
const formatearFechaTexto = require('../helpers/formatear-fecha-texto');

exports.generarExcel = async (req, res) => {
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

  // Traer todos los empleados para el periodo solicitado
  const data = await db.collection(collectionName)
    .find({ PERIODO: Number(periodo) })
    .sort({ EMPLEADO: 1 })
    .toArray();

  const fechaHasta = formatearFechaTexto(data[0]?.FECHHAS);
  console.log('Fecha hasta:', fechaHasta);


  // Agrupar por empleado y sumar percepciones/deducciones
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

  // Obtener los IDs de todos los empleados encontrados
  const empleadosIds = Object.keys(empleados).map(Number);
  // Buscar info de empleados (RFC, CURP)
  const empleadosInfo = await db.collection(empleadosCollection)
    .find({ EMPLEADO: { $in: empleadosIds } })
    .project({ EMPLEADO: 1, RFC: 1, CURP: 1, REGIMSS: 1, DEPTO: 1, CAT: 1, PUESTO: 1, CTABANCO: 1, NIVEL: 1, FECHAALTA: 1, TIPOEMP: 1, _id: 0 })
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
    .find({ PERIODO: Number(periodo) })
    .project({ EMPLEADO: 1, PERCDESC: 1, DESCRIPCION: 1, IMPORTE: 1, _id: 0 })
    .sort({ EMPLEADO: 1 })
    .toArray();


  // Crear un mapa para acceso rápido
  const infoMap = {};
  empleadosInfo.forEach(e => {
    infoMap[e.EMPLEADO] = { RFC: e.RFC || '', CURP: e.CURP || '' };
  });


  // Encabezados para el Excel
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

  // Construir filas de datos
  const nomnaRows = Object.values(empleados).map((item, idx) => ({
    RFC: infoMap[item.EMPLEADO]?.RFC || '',
    CURP: infoMap[item.EMPLEADO]?.CURP || '',
    FECHAP: item.FECHAP,
    FECHDES: item.FECHDES,
    FECHHAS: item.FECHHAS,
    DIASTRA: item.DIASTRA,
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
      Departamento: departamentosInfo.find(d => d.DEPTO === row.DEPTO)?.DESCRIPCION || '',
      Puesto: puestosInfo.find(p => p.PUESTO === row.PUESTO)?.DESCRIPCION || '',
      RiesgoPuesto: 1,
      PeriodicidadPago: 3,
      Banco: 12,
      CuentaBancaria: row.CTABANCO,
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
    PorcentajeTiempo: '100',
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
    Nombre: row.NOMBRE,
    Concepto: 'Pago de nómina',
    Cantidad: 1,
    Unidad: 'ACT',
    ValorUnitario: empleados[row.EMPLEADO].TotalPercepciones,
    Importe: empleados[row.EMPLEADO].TotalPercepciones,
    NumEmpleado: row.EMPLEADO
  }));


// Generar percepcionesRows como detalle plano (una fila por cada percepción de cada empleado)
const percepcionesRows = [];
empleadosInfo.forEach(row => {
  const detalle = percepcionesInfo.filter(
    p => p.EMPLEADO === row.EMPLEADO && p.PERCDESC < 500
  );
  detalle.forEach(d => {
    percepcionesRows.push({
      CURP: row.CURP,
      NumEmpleado: row.EMPLEADO,
      PERCDESC: d.PERCDESC,
      DESCRIPCION: d.DESCRIPCION,
      IMPORTE: d.IMPORTE,
      TOTALSUELDOS: empleados[row.EMPLEADO].TotalPercepciones,
      TOTALSEPARACIONINDEMNIZACION: 0,
      TOTALJUBILACIONPENSIONRETIRO: 0,
      TOTALGRAVADO: empleados[row.EMPLEADO].TotalPercepciones,
      TOTALEXENTO: 0,
      TIPOPERCEPION: '',
      CLAVE: '',
      CONCEPTO: '',
      IMPORTEGRAVADO: '',
      IMPORTEEXENTO: ''
    });
  });
});

const percepcionesHeaders = [
  { header: 'CURP', key: 'CURP', width: 15 },
  { header: 'NumEmpleado', key: 'NumEmpleado', width: 15 },
  { header: 'PERCDESC', key: 'PERCDESC', width: 10 },
  { header: 'DESCRIPCION', key: 'DESCRIPCION', width: 20 },
  { header: 'IMPORTE', key: 'IMPORTE', width: 15 },
  { header: 'TOTALSUELDOS', key: 'TOTALSUELDOS', width: 15 },
  { header: 'TOTALSEPARACIONINDEMNIZACION', key: 'TOTALSEPARACIONINDEMNIZACION', width: 15 },
  { header: 'TOTALJUBILACIONPENSIONRETIRO', key: 'TOTALJUBILACIONPENSIONRETIRO', width: 15 },
  { header: 'TOTALGRAVADO', key: 'TOTALGRAVADO', width: 15 },
  { header: 'TOTALEXENTO', key: 'TOTALEXENTO', width: 15 },
  { header: 'TIPOPERCEPION', key: 'TIPOPERCEPION', width: 15 },
  { header: 'CLAVE', key: 'CLAVE', width: 15 },
  { header: 'CONCEPTO', key: 'CONCEPTO', width: 15 },
  { header: 'IMPORTEGRAVADO', key: 'IMPORTEGRAVADO', width: 15 },
  { header: 'IMPORTEEXENTO', key: 'IMPORTEEXENTO', width: 15 }
];

// ...resto de tu código...



// Ya NO agregues la hoja PercepcionesDetalle

  // Crear hoja y libro de Excel
  const ws = XLSX.utils.json_to_sheet(nomnaRows);
  XLSX.utils.sheet_add_aoa(ws, [headers.map(h => h.header)], { origin: "A1" });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nomina');

  const wsEmisor = XLSX.utils.json_to_sheet(emisorRows);
  XLSX.utils.sheet_add_aoa(wsEmisor, [emisorHeaders.map(h => h.header)], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsEmisor, 'Emisor');

  const wsReceptor = XLSX.utils.json_to_sheet(receptorRows);
  XLSX.utils.sheet_add_aoa(wsReceptor, [receptorHeaders.map(h => h.header)], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsReceptor, 'Receptor');

  const wsEntidad = XLSX.utils.json_to_sheet(entidadRows);
  XLSX.utils.sheet_add_aoa(wsEntidad, [entidadHeaders.map(h => h.header)], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsEntidad, 'EntidadSNCF');

  const wsSubcontratacion = XLSX.utils.json_to_sheet(subcontratacionRows);
  XLSX.utils.sheet_add_aoa(wsSubcontratacion, [subcontratacionHeaders.map(h => h.header)], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsSubcontratacion, 'Subcontratacion');

  const wsConceptos = XLSX.utils.json_to_sheet(conceptosRows);
  XLSX.utils.sheet_add_aoa(wsConceptos, [conceptosHeaders.map(h => h.header)], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsConceptos, 'Conceptos');

  const wsPercepciones = XLSX.utils.json_to_sheet(percepcionesRows);
  XLSX.utils.sheet_add_aoa(wsPercepciones, [percepcionesHeaders.map(h => h.header)], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsPercepciones, 'Percepciones');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename=reporte_nomina.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
};