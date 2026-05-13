---
name: consulta-mongodb
description: >
  Patrones correctos para acceder a MongoDB en el proyecto SIRH injuve-backend
  usando el driver nativo (sin Mongoose). Cubre: uso del singleton getDb(),
  selección de colección según tipo, queries frecuentes y errores comunes.
  Usar en cualquier controller o helper que necesite leer o escribir MongoDB.
---

# Consulta MongoDB — SIRH injuve-backend

## Cuándo usar este skill

- Escribir una consulta MongoDB en un controller o helper nuevo
- Agregar operaciones de lectura/escritura a código existente
- Depurar errores de conexión o de colección no encontrada
- Decidir qué colección usar para un empleado de tipo 1 o tipo 2

---

## Regla fundamental: usar siempre getDb()

```javascript
// ✅ SIEMPRE así
const { getDb } = require('../helpers/mongo.helper');

async function miConsulta() {
  const db = getDb();
  return await db.collection('mnom01').find({}).toArray();
}

// ❌ NUNCA instanciar MongoClient directamente en controllers/helpers
const { MongoClient } = require('mongodb');
const client = new MongoClient(...); // No hacer esto
```

`getDb()` lanza `Error: No se ha establecido conexión con la base de datos` si se llama antes de que `conectarMongo()` complete. Esto solo ocurre si el código se ejecuta durante el arranque del servidor — en controllers y helpers siempre es seguro porque el servidor espera a MongoDB antes de escuchar.

---

## Colecciones según tipo de empleado

```javascript
// Patrón estándar en controllers
const tipo = parseInt(req.params.tipo); // 1 = base, 2 = confianza

const tablaEmpleados = tipo === 1 ? 'mnom01'  : 'mnom01h';
const tablaMovimtos  = tipo === 1 ? 'mnom12'  : 'mnom12h';
```

### Mapa completo de colecciones

| Colección | Contenido | Distinción por tipo |
|-----------|-----------|-------------------|
| `mnom01` | Empleados base | Tipo 1 |
| `mnom01h` | Empleados confianza/honorarios | Tipo 2 |
| `mnom12` | Movimientos de nómina (base) | Tipo 1 |
| `mnom12h` | Movimientos de nómina (confianza) | Tipo 2 |
| `mnom03` | Categorías/puestos | Sin distinción |
| `mnom04` | Departamentos | Sin distinción |
| `accesos` | Control de login por RFC | Sin distinción |
| `sueldoprestacionesbase` | Sueldo integrado empleados TIPOEMP=B | Sin distinción |
| `sueldoprestacionesconf` | Sueldo integrado empleados TIPOEMP≠B | Sin distinción |
| `usuarios` | Usuarios del sistema | Sin distinción |
| `niveles` | Tabla de niveles salariales base | Sin distinción |
| `nivelesconfianza` | Tabla de niveles salariales confianza | Sin distinción |

---

## Queries frecuentes

### findOne por ID de empleado

```javascript
const db = getDb();
const empleado = await db.collection('mnom01').findOne({ EMPLEADO: parseInt(id) });

if (!empleado) {
  return res.status(404).json({ error: 'Empleado no encontrado' });
}
```

### find con filtro de periodo

```javascript
const db = getDb();
const movimientos = await db.collection('mnom12').find({
  EMPLEADO: parseInt(empleado),
  PERIODO: parseInt(periodo)
}).toArray();
```

### Agregar por periodo (patrón resumen de nómina)

```javascript
const db = getDb();
const resumen = await db.collection('mnom12').aggregate([
  {
    $group: {
      _id: '$PERIODO',
      totalImporte: { $sum: '$IMPORTE' }
    }
  },
  { $sort: { _id: -1 } }
]).toArray();
```

### updateMany (patrón en getDatosNomina)

```javascript
const db = getDb();
await db.collection('mnom12h').updateMany(
  { PERCDESC: 23 },
  { $set: { DESCRIPCION: 'PRESTADOR DE SERVICIOS' } }
);
```

### Upsert en accesos

```javascript
const db = getDb();
const existe = await db.collection('accesos').findOne({ RFC: rfc });
if (!existe) {
  await db.collection('accesos').insertOne({
    RFC: rfc,
    TIPO: tipo, // 1 o 2
    ADMIN: 0
  });
}
```

---

## Tipos de datos en MongoDB

Los campos numéricos solo son `Number` si la colección fue cargada con el CSV después de estar registrada en `tablas-conversion-camposnumericos.js`. Si no, pueden ser `String`.

**Siempre usar `parseInt()` al comparar campos que deben ser numéricos:**
```javascript
// Seguro aunque el valor en MongoDB sea String o Number
await db.collection('mnom12').find({ EMPLEADO: parseInt(empleado) }).toArray();
```

---

## Manejo de errores

```javascript
exports.miEndpoint = async (req, res) => {
  try {
    const db = getDb();
    const resultado = await db.collection('mnom01').find({}).toArray();
    res.json(resultado);
  } catch (error) {
    console.error('Error en miEndpoint:', error);
    // No exponer detalles internos al cliente
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
```

---

## Errores comunes

| Error | Causa | Solución |
|-------|-------|---------|
| `No se ha establecido conexión` | `getDb()` llamado antes de que MongoDB conecte | No ejecutar queries en código síncrono de módulo; solo dentro de funciones async |
| Resultado vacío cuando debería tener datos | `EMPLEADO` guardado como String, query con Number | Verificar tipo en MongoDB y usar `parseInt()` en el filtro |
| `Cannot read property 'collection' of undefined` | `db` es `undefined` — `getDb()` no lanzó error pero retornó algo inesperado | Verificar que `conectarMongo` completó correctamente en `server.js` |
| Query lenta en colección grande | Sin índice en campo de filtro frecuente | Crear índice en MongoDB: `db.collection.createIndex({ EMPLEADO: 1 })` |
