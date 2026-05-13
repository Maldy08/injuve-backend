---
name: generar-recibo-nomina
description: >
  Genera recibos de nómina en PDF usando jsreport + Handlebars en el proyecto
  SIRH injuve-backend. Cubre el flujo completo: obtener datos con
  getDatosNomina, seleccionar template según tipo, renderizar con jsreport y
  enviar como stream. Usar cuando se trabaje con generación de PDFs de nómina.
---

# Generar Recibo de Nómina PDF — SIRH injuve-backend

## Cuándo usar este skill

- Implementar o modificar el endpoint de generación de PDF
- Depurar errores de jsreport / Chromium
- Agregar nuevos datos al recibo
- Crear un template alternativo de nómina

---

## Arquitectura del flujo PDF

```
Request → pdf.controller.js
             ↓
         getDatosNomina(empleado, periodo, tipo)   ← helpers/get-datos-nomina.js
             ↓
         initJsReport()                             ← helpers/jsreport.helper.js (singleton)
             ↓
         jsreport.render({ template, data })
             ↓
         result.stream.pipe(res)                   → PDF al cliente
```

**Templates Handlebars:**
| `tipo` | Template | Empleados |
|--------|----------|-----------|
| `1` | `templates/nomina.html` | Base (`mnom01` / `mnom12`) |
| `2` | `templates/nomina-asim.html` | Confianza/honorarios (`mnom01h` / `mnom12h`) |

---

## Implementación del controller

```javascript
const path = require('path');
const fs = require('fs');
const getDatosNomina = require('../helpers/get-datos-nomina');
const { initJsReport } = require('../helpers/jsreport.helper');

// GET /api/backend/pdf/:empleado/:periodo/:tipo
exports.generarPDF = async (req, res) => {
  const empleado = parseInt(req.params.empleado);
  const periodo  = parseInt(req.params.periodo);
  const tipo     = parseInt(req.params.tipo);

  if (isNaN(empleado) || isNaN(periodo) || isNaN(tipo)) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }

  try {
    // 1. Inicializar jsreport (singleton — solo init real en el primer llamado)
    const jsreport = await initJsReport();

    // 2. Obtener datos de nómina del empleado
    const data = await getDatosNomina(empleado, periodo, tipo);

    // 3. Seleccionar template según tipo
    const template = tipo == 1 ? 'nomina' : 'nomina-asim';
    const templateHtml = fs.readFileSync(
      path.join(__dirname, `../templates/${template}.html`)
    ).toString();

    // 4. Renderizar PDF
    const result = await jsreport.render({
      template: {
        content: templateHtml,
        engine: 'handlebars',
        recipe: 'chrome-pdf'
      },
      data
    });

    // 5. Enviar como stream
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=recibo_${empleado}_${periodo}.pdf`);
    result.stream.pipe(res);

  } catch (err) {
    console.error('Error al generar PDF:', err);
    res.status(500).json({ error: 'Error al generar el PDF' });
  }
};
```

---

## Estructura de datos que devuelve getDatosNomina

`getDatosNomina(empleado, periodo, tipo)` retorna un objeto con estas propiedades:

```javascript
{
  empleadoData,        // Documento completo de mnom01 / mnom01h
  deptoData,           // Documento de mnom04 (solo tipo 1)
  puestoData,          // Documento de mnom03 (solo tipo 1)
  prestacionesData,    // Documento de sueldoprestacionesbase o sueldoprestacionesconf
  sueldoIntegrado,     // Number
  conceptos,           // Array — todos los conceptos con columnas formateadas:
                       //   .percepcion  → importe formateado si es percepción, else ""
                       //   .prestacion  → importe formateado si es prestación, else ""
                       //   .deduccion   → importe formateado si es deducción, else ""
                       //   .DIASTRA     → días ajustados según reglas PERCDESC
  percepciones,        // Array — solo conceptos de percepción
  prestaciones,        // Array — solo conceptos de prestación
  deducciones,         // Array — solo conceptos de deducción
  totalPercepciones,   // Number
  totalPrestaciones,   // Number
  totalDeducciones,    // Number
  totalNeto,           // Number  (percepciones + prestaciones - deducciones)
  totalNetoLetras,     // String  (totalNeto en palabras, ej: "MIL DOSCIENTOS PESOS 50/100 M.N.")
  periodo,             // Number  (el periodo solicitado)
  // ... fechas y otros campos de presentación
}
```

> Si `periodo === 0`, `getDatosNomina` devuelve datos de **todos** los periodos del empleado.

---

## Configuración de jsreport

`helpers/jsreport.helper.js` expone un singleton — **siempre llamar `initJsReport()`**, nunca instanciar jsreport directamente.

```javascript
// ✅ Correcto
const { initJsReport } = require('../helpers/jsreport.helper');
const jsreport = await initJsReport();

// ❌ Incorrecto — crea una instancia nueva cada vez
const jsreport = require('jsreport')({...});
await jsreport.init();
```

**Comportamiento por plataforma:**
- **macOS / Linux (EC2):** Configuración mínima, sin opciones especiales de Chromium
- **Windows:** Crea directorio `jsreport-temp/` y pasa `--allow-file-access-from-files` a Chromium. El helper lo detecta automáticamente con `process.platform === 'win32'`

---

## Agregar datos al recibo

Para incluir nuevos datos en el PDF:

1. Agregar la consulta MongoDB en `helpers/get-datos-nomina.js`
2. Incluir el valor en el objeto retornado por la función
3. Referenciar en el template Handlebars con `{{nombreCampo}}`

Para listas/arrays en Handlebars:
```handlebars
{{#each conceptos}}
  <tr>
    <td>{{DESCRIPCION}}</td>
    <td>{{percepcion}}</td>
    <td>{{prestacion}}</td>
    <td>{{deduccion}}</td>
  </tr>
{{/each}}
```

---

## Depuración de errores comunes

| Error | Causa probable | Solución |
|-------|---------------|----------|
| `Error: Chrome not found` | Chromium no instalado | `npm install jsreport-chrome-pdf` o verificar instalación |
| `Error: ENOENT: no such file or directory` en template | Ruta incorrecta del HTML | Verificar `path.join(__dirname, '../templates/...')` |
| PDF en blanco | Template sin datos / Handlebars con keys incorrectos | Hacer `console.log(data)` antes de `render()` para ver la estructura |
| `getDb() not initialized` | jsreport o MongoDB no listos | El servidor inicializa ambos en `server.js` antes de escuchar — no llamar desde código de arranque síncrono |
| Error en Windows con rutas locales | Chromium no puede acceder a archivos locales | El helper ya incluye `--allow-file-access-from-files` en Windows |
