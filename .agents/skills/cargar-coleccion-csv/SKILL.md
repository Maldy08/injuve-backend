---
name: cargar-coleccion-csv
description: >
  Agrega soporte para una nueva colección MongoDB al endpoint de carga de CSV
  en SIRH injuve-backend. Cubre: definir campos numéricos, decidir estrategia
  de reemplazo (total vs por periodo), y si aplica auto-crear entradas en
  accesos. Usar cuando se pida soportar carga CSV de una nueva tabla.
---

# Cargar Colección CSV — SIRH injuve-backend

## Cuándo usar este skill

- "Necesito subir datos de la colección X por CSV"
- "Agrega soporte para cargar la tabla Y desde un archivo"
- "El upload de CSV no reconoce mi colección nueva"

---

## Arquitectura del upload

`POST /api/backend/upload/:coleccion`
- Requiere: `multipart/form-data` con el archivo en el campo `file`
- Auth: `x-api-key` header (agentes automáticos) **o** JWT válido (humanos)
- El archivo se guarda temporalmente en `uploads/` y se elimina tras el procesamiento

**Archivos involucrados:**
- `helpers/tablas-conversion-camposnumericos.js` — mapeo de campos numéricos por colección
- `controllers/upload.controller.js` — lógica de procesamiento (no modificar salvo excepciones)

---

## Flujo paso a paso

### 1. Decidir estrategia de reemplazo

| Situación | Estrategia | Colecciones que ya la usan |
|-----------|------------|---------------------------|
| La tabla tiene datos históricos por periodo de nómina | **Reemplazo parcial** — borra solo el `PERIODO` que trae el CSV | `mnom12`, `mnom12h` |
| La tabla es catálogo/maestro (se sobreescribe completa) | **Reemplazo total** — `deleteMany({})` + `insertMany` | Todas las demás |

> Si la nueva colección es de tipo nómina con campo `PERIODO`, hay que modificar `upload.controller.js` para incluirla en la condición `if (['mnom12', 'mnom12h'].includes(coleccion))`.

### 2. Identificar campos numéricos

Revisar el CSV de ejemplo e identificar columnas que deben almacenarse como `Number`, no como `String`.

Regla: cualquier campo que se use en cálculos, filtros numéricos o sumas **debe** estar en la lista.

### 3. Registrar en tablas-conversion-camposnumericos.js

Abrir `helpers/tablas-conversion-camposnumericos.js` y agregar la entrada:

```javascript
const camposNumericos = {
  // ... entradas existentes ...

  // NUEVA COLECCIÓN
  nombre_coleccion: ['CAMPO1', 'CAMPO2', 'CAMPO_NUMERICO'],
};
```

**Campos típicos que siempre son numéricos:**
- Identificadores: `EMPLEADO`, `DEPTO`, `CAT`, `NIVEL`, `PUESTO`
- Importes: `IMPORTE`, `SUELDO`, `MONTO`
- Periodos: `PERIODO`
- Contadores: `RECIBO`, `DIASTRA`

### 4. Auto-creación de accesos (solo para mnom01/mnom01h)

Solo aplica si la nueva colección **reemplaza** a `mnom01` o `mnom01h`. El controller ya maneja estos casos automáticamente:

```javascript
// Ya implementado en upload.controller.js — NO duplicar
if (coleccion === 'mnom01' || coleccion === 'mnom01h') {
  // Crea entradas en 'accesos' para RFCs nuevos con TIPO y ADMIN=0
}
```

Si la nueva colección también requiere crear registros en otra colección al hacer upload, agregar la lógica al controller `upload.controller.js` dentro del bloque `on('end')`.

### 5. Validar BOM en el CSV

El controller ya strip automáticamente el BOM (`\uFEFF`) del primer campo. No se requiere acción. Si el CSV viene con separador diferente a `,`, verificar la opción `separator` en el pipe de `csv-parser`.

---

## Checklist

- [ ] Colección agregada a `camposNumericos` en `tablas-conversion-camposnumericos.js`
- [ ] Campos identificadores y numéricos incluidos en la lista
- [ ] Estrategia de reemplazo definida (total vs por periodo)
- [ ] Si es colección con `PERIODO`: agregada a la condición en `upload.controller.js`
- [ ] Si requiere efecto secundario (crear en otra colección): lógica agregada en el controller
- [ ] Probado con CSV real (verificar que los campos son `Number` en MongoDB, no `String`)

---

## Referencia: colecciones existentes

```javascript
mnom01:   ['EMPLEADO', 'DEPTO', 'CAT', 'PROGRAMA', 'SUBPROGRAMA', 'META',
           'ACCION', 'MPIO', 'NIVEL', 'PUESTO', 'SUELDO', 'REGIMSS', 'CTABANCO']

mnom01h:  // idéntico a mnom01

mnom12:   ['EMPLEADO', 'PERIODO', 'PERCDESC', 'IMPORTE', 'TIPONOM',
           'RECIBO', 'DIASTRA', 'NIVEL', 'CLUES', 'DEPTO']

mnom12h:  ['EMPLEADO', 'PERIODO', 'PERCDESC', 'IMPORTE', 'TIPONOM',
           'RECIBO', 'DIASTRA', 'NIVEL', 'DEPTO']

niveles / nivelesconfianza:
          ['NIVEL', 'SUELDO', 'CANASTABASICA', 'BONOTRANSPORTE',
           'PREVISIONSOCIAL', 'FOMENTOEDUCATIVO']

sueldoprestacionesbase / sueldoprestacionesconf:
          ['EMPLEADO', 'SUELDOMES', 'SUELDODIA', 'CANASTABASICA',
           'BONOTRANSPORTE', 'PREVISIONSOCIAL', 'FOMENTOEDUCATIVO',
           'QUINQUENIO', 'AGUICATORCENAL', 'SUELDOINTEGRADO']
```
