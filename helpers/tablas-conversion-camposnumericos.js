  // Mapeo de campos numéricos por colección
  const camposNumericos = {
    mnom01: ['EMPLEADO', 'DEPTO', 'CAT', 'PROGRAMA', 'SUBPROGRAMA', 'META', 'ACCION', 'MPIO', 'NIVEL', 'PUESTO', 'SUELDO', 'REGIMSS', 'CTABANCO'],
    mnom01h: ['EMPLEADO', 'DEPTO', 'CAT', 'PROGRAMA', 'SUBPROGRAMA', 'META', 'ACCION', 'MPIO', 'NIVEL', 'PUESTO', 'SUELDO', 'REGIMSS', 'CTABANCO'],
    mnom03: ['CATEGORIA'],
    mnom04: ['DEPTO', 'SUBPROGRAMA', 'DEPTOCONTAB', 'PROGRAMA', 'CUENTA', 'EMPLEADO'],
    mnom12: ['EMPLEADO', 'PERIODO', 'PERCDESC', 'IMPORTE', 'TIPONOM', 'RECIBO', 'DIASTRA', 'NIVEL', 'CLUES', 'DEPTO'],
    mnom12h: ['EMPLEADO', 'PERIODO', 'PERCDESC', 'IMPORTE', 'TIPONOM', 'RECIBO', 'DIASTRA', 'NIVEL', 'DEPTO'],
    mnom90: ['PUESTO'],
    niveles: ['NIVEL', 'SUELDO', 'CANASTABASICA', 'BONOTRANSPORTE', 'PREVISIONSOCIAL', 'FOMENTOEDUCATIVO'],
    nivelesconfianza: ['NIVEL', 'SUELDO', 'CANASTABASICA', 'BONOTRANSPORTE', 'PREVISIONSOCIAL', 'FOMENTOEDUCATIVO'],
    sueldoprestacionesbase: ['EMPLEADO', 'SUELDOMES', 'SUELDODIA', 'CANASTABASICA', 'BONOTRANSPORTE', 'PREVISIONSOCIAL', 'FOMENTOEDUCATIVO',
      'QUINQUENIO', 'AGUICATORCENAL', 'SUELDOINTEGRADO'
    ],
    sueldoprestacionesconf:['EMPLEADO', 'SUELDOMES', 'SUELDODIA', 'CANASTABASICA', 'BONOTRANSPORTE', 'PREVISIONSOCIAL', 'FOMENTOEDUCATIVO',
        'QUINQUENIO', 'AGUICATORCENAL', 'SUELDOINTEGRADO'
      ],
    bss: ['tiporegimen', 'isstecali', 'diaspagados', 'departamento', 'clabe','periocidad','tipopercepcion', 'tipodeduccion', 'tipoprestacion', 'tipoincapacidad', 'tipoincapacidad', 'tipoincapacidad', 'tipoincapacidad', 'tipoincapacidad','importe','importe_new'],  
  };

  module.exports = camposNumericos;