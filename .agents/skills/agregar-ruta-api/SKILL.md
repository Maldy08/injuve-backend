---
name: agregar-ruta-api
description: >
  Agrega un nuevo endpoint REST al proyecto SIRH/injuve-backend siguiendo el
  patrón establecido: route thin + controller con lógica, middleware correcto
  según nivel de acceso, registro en server.js y JSDoc para Swagger. Usar
  cuando se pida crear, agregar o implementar un nuevo endpoint o ruta API.
---

# Agregar Ruta API — SIRH injuve-backend

## Cuándo usar este skill

- "Agrega un endpoint para..."
- "Necesito una ruta que devuelva..."
- "Crea un nuevo controller para..."

---

## Flujo paso a paso

### 1. Determinar nivel de acceso

Antes de escribir código, decide cuál de los tres niveles aplica:

| Nivel | Cuándo | Middleware |
|-------|--------|-----------|
| **Público** | Login, registro | Sin middleware — solo en `/api/backend/auth` |
| **API key o JWT** | Carga automatizada de datos | `apiKeyOrJwtMiddleware` — solo en `/api/backend/upload` |
| **JWT requerido** | Todo lo demás | Automático por posición en `server.js` |

> Las rutas registradas **después** de `app.use(authMiddleware)` en `server.js` requieren JWT sin ninguna configuración adicional. No agregues middleware manualmente a esas rutas.

---

### 2. Crear el archivo de rutas

**Ubicación:** `routes/<recurso>.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const { metodo1, metodo2 } = require('../controllers/<recurso>.controller');

/**
 * @swagger
 * /api/backend/<recurso>:
 *   get:
 *     summary: Descripción breve
 *     tags: [<Recurso>]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tipo
 *         required: true
 *         schema:
 *           type: integer
 *           enum: [1, 2]
 *         description: "1 = base (mnom01/mnom12), 2 = confianza (mnom01h/mnom12h)"
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Token inválido o ausente
 *       500:
 *         description: Error interno
 */
router.get('/:tipo', metodo1);

module.exports = router;
```

**Reglas del archivo de rutas:**
- Solo definir rutas — sin lógica de negocio
- Parámetro `tipo` siempre como `/:tipo` cuando distinga entre base y confianza
- Incluir JSDoc `@swagger` en cada ruta pública

---

### 3. Crear el controller

**Ubicación:** `controllers/<recurso>.controller.js`

```javascript
const { getDb } = require('../helpers/mongo.helper');

exports.metodo1 = async (req, res) => {
  const tipo = parseInt(req.params.tipo);

  // Validar parámetros en la frontera del sistema
  if (isNaN(tipo) || ![1, 2].includes(tipo)) {
    return res.status(400).json({ error: 'Parámetro tipo inválido. Use 1 (base) o 2 (confianza).' });
  }

  try {
    const db = getDb();
    const collection = tipo === 1 ? 'mnom01' : 'mnom01h'; // o mnom12/mnom12h para nómina

    const resultado = await db.collection(collection).find({}).toArray();

    res.json(resultado);
  } catch (error) {
    console.error(`Error en metodo1:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
```

**Reglas del controller:**
- Siempre `async/await` con `try/catch`
- Usar `getDb()` — nunca importar `MongoClient` directamente
- Seleccionar colección según `tipo`: `tipo===1` → tabla base, `tipo===2` → tabla confianza
- `parseInt()` en todos los parámetros numéricos de URL
- No retornar stack traces al cliente — solo mensajes genéricos

---

### 4. Registrar la ruta en server.js

Abrir `server.js` y agregar la línea **después** del bloque `app.use(authMiddleware)`:

```javascript
// Rutas protegidas (ya existentes)
app.use(`${baseApiPath}/home`, require('./routes/home.routes'));
// ... otras rutas ...

// AGREGAR AQUÍ (manteniendo orden alfabético o por dominio)
app.use(`${baseApiPath}/<recurso>`, require('./routes/<recurso>.routes'));
```

> ⚠️ Si la ruta es pública o usa API key, colocarla ANTES de `app.use(authMiddleware)` en la sección correspondiente.

---

### 5. Verificar Swagger

El JSDoc en el archivo de rutas se procesa automáticamente. Comprobar en:
```
GET http://localhost:3001/api-docs
```

Asegurarse de que `swagger.js` incluya la ruta del nuevo archivo en la sección `apis`:
```javascript
apis: ['./routes/*.routes.js']  // glob ya cubre todos los archivos de rutas
```

---

## Checklist de calidad

Antes de considerar el endpoint terminado:

- [ ] Parámetros numéricos validados con `parseInt()` e `isNaN()`
- [ ] `tipo` validado en `[1, 2]` si aplica
- [ ] `try/catch` en toda operación con MongoDB
- [ ] Colección seleccionada correctamente según `tipo`
- [ ] JSDoc `@swagger` presente en la ruta
- [ ] Ruta registrada en `server.js` en el bloque correcto (público / upload / JWT)
- [ ] No se exponen stack traces en respuestas de error

---

## Patrón de colecciones según `tipo`

| `tipo` | Empleados | Nómina |
|--------|-----------|--------|
| `1` | `mnom01` | `mnom12` |
| `2` | `mnom01h` | `mnom12h` |

Colecciones de soporte (sin distinción de tipo): `mnom03`, `mnom04`, `accesos`, `sueldoprestacionesbase`, `sueldoprestacionesconf`, `usuarios`, `niveles`, `nivelesconfianza`.
