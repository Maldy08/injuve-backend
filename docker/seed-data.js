print('📝 Insertando datos de prueba...');

db = db.getSiblingDB('injuve');

// Usuario admin tipo 1
db.usuarios.insertOne({
  EMPLEADO: 123,
  CORREO: "admin@juventudbc.com.mx",
  PASSWORD: "123456",
  TIPO: 1
});

// Empleado admin
db.mnom01.insertOne({
  EMPLEADO: 123,
  NOMBRE: "JUAN CARLOS",
  APPAT: "PÉREZ",
  APMAT: "GARCÍA",
  RFC: "PEGJ800101ABC",
  CURP: "PEGJ800101HDFRNN09",
  EMAIL: "admin@juventudbc.com.mx",
  DEPTO: 1,
  CAT: 1,
  NIVEL: 1,
  PUESTO: 1,
  SUELDO: 500.00,
  REGIMSS: "12345678901",
  CTABANCO: "1234567890123456",
  TIPOEMP: "B",
  VALIDEZ: "V",
  FECHAALTA: "01/01/2020"
});

// Usuario honorarios tipo 2
db.usuarios.insertOne({
  EMPLEADO: 456,
  CORREO: "honorarios@juventudbc.com.mx",
  PASSWORD: "123456",
  TIPO: 2
});

// Empleado honorarios
db.mnom01h.insertOne({
  EMPLEADO: 456,
  NOMBRE: "MARÍA ELENA",
  APPAT: "LÓPEZ",
  APMAT: "MARTÍNEZ",
  RFC: "LOMM850515DEF",
  CURP: "LOMM850515MJCPRT08",
  EMAIL: "honorarios@juventudbc.com.mx",
  SUELDO: 300.00,
  VALIDEZ: "V",
  FECHAALTA: "15/03/2022",
  CONTRATO: "HON-2022-001"
});

// Accesos
db.accesos.insertMany([
  { RFC: "PEGJ800101ABC", TIPO: 1, ADMIN: 1 },
  { RFC: "LOMM850515DEF", TIPO: 2, ADMIN: 0 }
]);

// Datos organizacionales
db.mnom04.insertOne({ DEPTO: 1, DESCRIPCION: "DIRECCIÓN GENERAL" });
db.mnom03.insertOne({ CATEGORIA: 1, DESCRIPCION: "DIRECTOR GENERAL" });
db.mnom90.insertOne({ PUESTO: 1, DESCRIPCION: "DIRECTOR GENERAL" });

// Recibos de prueba empleado tipo 1
const recibos1 = [
  { PERCDESC: 1, DESCRIPCION: "SUELDO BASE", IMPORTE: 15000, DIASTRA: 112 },
  { PERCDESC: 13, DESCRIPCION: "CANASTA BÁSICA", IMPORTE: 2000, DIASTRA: 0 },
  { PERCDESC: 500, DESCRIPCION: "ISR", IMPORTE: 2500, DIASTRA: 0 },
  { PERCDESC: 501, DESCRIPCION: "ISSSTE", IMPORTE: 1500, DIASTRA: 0 }
];

recibos1.forEach(concepto => {
  db.mnom12.insertOne({
    EMPLEADO: 123,
    PERIODO: 202501,
    FECHDES: "01/01/2025",
    FECHHAS: "15/01/2025",
    FECHAP: "16/01/2025",
    ...concepto
  });
});

// Recibos de prueba empleado tipo 2
const recibos2 = [
  { PERCDESC: 23, DESCRIPCION: "PRESTADOR DE SERVICIOS", IMPORTE: 8000, DIASTRA: 14 },
  { PERCDESC: 500, DESCRIPCION: "ISR", IMPORTE: 800, DIASTRA: 0 }
];

recibos2.forEach(concepto => {
  db.mnom12h.insertOne({
    EMPLEADO: 456,
    PERIODO: 202501,
    FECHDES: "01/01/2025",
    FECHHAS: "15/01/2025",
    FECHAP: "16/01/2025",
    ...concepto
  });
});

print('✅ Datos de prueba creados correctamente');
print('👤 Usuarios disponibles:');
print('   admin@juventudbc.com.mx / 123456 (Tipo 1)');
print('   honorarios@juventudbc.com.mx / 123456 (Tipo 2)');