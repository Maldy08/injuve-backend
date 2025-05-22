const XLSX = require('xlsx');
const { getDb } = require('../helpers/mongo.helper');
const formatearFechaTexto = require('../helpers/formatear-fecha-texto');

exports.percepcionesPivotPorPeriodo = async (req, res) => {
  const db = getDb();
  const { periodo } = req.params;
  if (!periodo) {
    return res.status(400).json({ error: "Parámetro periodo inválido" });
  }


  const percepciones = await db.collection('mnom12')
    .find({ PERIODO: Number(periodo), PERCDESC: { $lte: 500 } })
    .project({ EMPLEADO: 1, PERCDESC: 1, DESCRIPCION: 1, IMPORTE: 1, _id: 0 })
    .toArray();

  
  const empleadosRFC = await db.collection('mnom01')
    .find({ EMPLEADO: { $in: percepciones.map(p => p.EMPLEADO) } })
    .project({ EMPLEADO: 1, RFC: 1, CURP: 1, _id: 0 })
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

  const empleados = {};
  percepciones.forEach(p => {
    if (!empleados[p.EMPLEADO]) empleados[p.EMPLEADO] = { EMPLEADO: p.EMPLEADO };
    empleados[p.EMPLEADO][p.DESCRIPCION] = p.IMPORTE;
  });

  const headers = [
    { header: 'EMPLEADO', key: 'EMPLEADO', width: 10 },
    ...descripcionesUnicas.map(desc => ({ header: desc, key: desc, width: 20 }))
  ];

  const rows = Object.values(empleados);

  const XLSX = require('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers.map(h => h.key) });
  XLSX.utils.sheet_add_aoa(ws, [headers.map(h => h.header)], { origin: "A1" });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PivotPercepciones');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const fileName = `PIVOT_PERCEPCIONES_${periodo}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
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
    DIASTRA: item.DIASTRA / 8,
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
    Nombre: row.NOMBRE,
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