print('🔧 Configurando MongoDB para SIRH...');

db = db.getSiblingDB('injuve');

// Crear usuario para la aplicación
db.createUser({
  user: 'sirh_user',
  pwd: 'sirh_password',
  roles: [{ role: 'readWrite', db: 'injuve' }]
});

// Crear índices para mejor rendimiento
print('📊 Creando índices...');

// Usuarios
db.createCollection('usuarios');
db.usuarios.createIndex({ "CORREO": 1 }, { unique: true });
db.usuarios.createIndex({ "EMPLEADO": 1 }, { unique: true });

// Empleados tipo 1
db.createCollection('mnom01');
db.mnom01.createIndex({ "EMPLEADO": 1 }, { unique: true });
db.mnom01.createIndex({ "RFC": 1 }, { unique: true });

// Empleados tipo 2
db.createCollection('mnom01h');
db.mnom01h.createIndex({ "EMPLEADO": 1 }, { unique: true });
db.mnom01h.createIndex({ "RFC": 1 }, { unique: true });

// Nóminas
db.createCollection('mnom12');
db.mnom12.createIndex({ "EMPLEADO": 1, "PERIODO": 1 });

db.createCollection('mnom12h');
db.mnom12h.createIndex({ "EMPLEADO": 1, "PERIODO": 1 });

// Otras colecciones
db.createCollection('accesos');
db.accesos.createIndex({ "RFC": 1 }, { unique: true });

db.createCollection('mnom04');
db.createCollection('mnom03');
db.createCollection('mnom90');
db.createCollection('bss');

print('✅ MongoDB configurado correctamente');