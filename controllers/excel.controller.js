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

  console.log('Registros traídos de MongoDB:', data.length, data.map(d => d.EMPLEADO));

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
  console.log('IDs buscados:', empleadosIds);

  // Buscar info de empleados (RFC, CURP)
  const empleadosInfo = await db.collection(empleadosCollection)
    .find({ EMPLEADO: { $in: empleadosIds } })
    .project({ EMPLEADO: 1, RFC: 1, CURP: 1 })
    .toArray();
  console.log('Empleados encontrados:', empleadosInfo);

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


  const receptorHeaders = [
    
  ]


  // Crear hoja y libro de Excel
  const ws = XLSX.utils.json_to_sheet(nomnaRows);
  XLSX.utils.sheet_add_aoa(ws, [headers.map(h => h.header)], { origin: "A1" });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nomina');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename=reporte_nomina.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
};