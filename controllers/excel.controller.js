const XLSX = require('xlsx');
const { getDb } = require('../helpers/mongo.helper');

exports.generarExcel = async (req, res) => {
  const db = getDb();
  const { periodo, tipo } = req.params;
  if (!periodo || !tipo) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  const collectionName = tipo == 1 ? 'mnom12' : 'mnom12h';
  const empleadosCollection = tipo == 1 ? 'mnom01' : 'mnom01h';

  // Traer todos los empleados para el periodo solicitado
  const data = await db.collection(collectionName)
    .find({ PERIODO: Number(periodo) })
    .sort({ EMPLEADO: 1 })
    .toArray();

  //console.log('Registros traídos de MongoDB:', data.length, data.map(d => d.EMPLEADO)); 

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

  console.log('Empleados agrupados:', empleados);
  
  // Obtener los IDs de todos los empleados encontrados
  const empleadosIds = Object.keys(empleados).map(Number);
  // Buscar info de empleados (RFC, CURP)
  const empleadosInfo = await db.collection(empleadosCollection)
    .find({ EMPLEADO: { $in: empleadosIds } })
    .project({ EMPLEADO: 1, RFC: 1, CURP: 1 })
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


  const receptorRows = empleadosInfo.map(row => ({
    CURP: row.CURP,
    NumSeguridadSocial: ' ' ,
    FechaInicioRelLaboral: '',
    Antiguedad: '',
    TipoContrato: '',
    Sindicalizado: '',
    TipoJornada: '',
    TipoRegimen: '',
    NumEmpleado: row.EMPLEADO,
    Departamento: '',
    Puesto: '',
    RiesgoPuesto: '',
    PeriodicidadPago: '',
    Banco: '',
    CuentaBancaria: '',
    SalarioBaseCotApor: 0,
    SalarioDiarioIntegrado: 0,
    ClaveEntFed: '',
    NnumEmpleado: ''
  }));

  // Crear hoja y libro de Excel
  const ws = XLSX.utils.json_to_sheet(nomnaRows);
  XLSX.utils.sheet_add_aoa(ws, [headers.map(h => h.header)], { origin: "A1" });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nomina');

  const wsEmisor = XLSX.utils.json_to_sheet(emisorRows);
  XLSX.utils.sheet_add_aoa(wsEmisor, [emisorHeaders.map(h => h.header)], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, wsEmisor, 'Emisor');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename=reporte_nomina.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
};