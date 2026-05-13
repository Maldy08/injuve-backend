---
name: clasificar-percdesc
description: >
  Aplica correctamente la lógica de clasificación PERCDESC del sistema SIRH
  para distinguir percepciones, prestaciones y deducciones, incluyendo los
  casos especiales de los códigos 40, 60 y 570. Usar en cualquier cálculo,
  filtro o agrupación de conceptos de nómina.
---

# Clasificar PERCDESC — SIRH injuve-backend

## Cuándo usar este skill

- Filtrar conceptos de nómina por tipo (percepción, prestación, deducción)
- Implementar cálculos de totales en controllers o helpers
- Crear agregaciones MongoDB sobre `mnom12` / `mnom12h`
- Revisar si un código PERCDESC cae en la categoría correcta

---

## Reglas de clasificación

### Tipo 1 — Empleados base (`mnom12`)

| Rango PERCDESC | Clasificación | Casos especiales |
|----------------|---------------|-----------------|
| 1 – 12 | **Percepción** | |
| 13 – 499 | **Prestación** | Excepto 40 y 60 → Percepción |
| ≥ 500 | **Deducción** | Excepto 570 → excluir de deducciones |
| 40, 60 (cualquier rango) | **Percepción** | Prioridad sobre el rango |

### Tipo 2 — Empleados confianza/honorarios (`mnom12h`)

| Rango PERCDESC | Clasificación | Casos especiales |
|----------------|---------------|-----------------|
| 1 – 23 | **Percepción** | |
| 24 – 499 | **Prestación** | Excepto 40 y 60 → Percepción |
| ≥ 500 | **Deducción** | Excepto 570 → excluir de deducciones |
| 40, 60 (cualquier rango) | **Percepción** | Prioridad sobre el rango |

---

## Implementación en JavaScript

```javascript
// Filtros sobre un array de conceptos (conceptosRaw)
// donde cada elemento tiene la propiedad PERCDESC (Number)

// ── TIPO 1 ──────────────────────────────────────────────────────────────────
const percepciones_t1 = conceptosRaw.filter(c =>
  (c.PERCDESC >= 1 && c.PERCDESC < 13) ||
  c.PERCDESC === 40 ||
  c.PERCDESC === 60
);

const prestaciones_t1 = conceptosRaw.filter(c =>
  c.PERCDESC >= 13 &&
  c.PERCDESC < 500 &&
  c.PERCDESC !== 40 &&
  c.PERCDESC !== 60
);

const deducciones_t1 = conceptosRaw.filter(c =>
  c.PERCDESC >= 500 &&
  c.PERCDESC !== 570
);

// ── TIPO 2 ──────────────────────────────────────────────────────────────────
const percepciones_t2 = conceptosRaw.filter(c =>
  (c.PERCDESC >= 1 && c.PERCDESC < 24) ||
  c.PERCDESC === 40 ||
  c.PERCDESC === 60
);

const prestaciones_t2 = conceptosRaw.filter(c =>
  c.PERCDESC >= 24 &&
  c.PERCDESC < 500 &&
  c.PERCDESC !== 40 &&
  c.PERCDESC !== 60
);

const deducciones_t2 = conceptosRaw.filter(c =>
  c.PERCDESC >= 500 &&
  c.PERCDESC !== 570
);

// ── SELECTOR POR TIPO ────────────────────────────────────────────────────────
const percepciones = tipo == 1 ? percepciones_t1 : percepciones_t2;
const prestaciones = tipo == 1 ? prestaciones_t1 : prestaciones_t2;
const deducciones  = tipo == 1 ? deducciones_t1  : deducciones_t2;  // mismo para ambos tipos
```

---

## Implementación en agregación MongoDB

Para cálculos directos en MongoDB (sin traer todos los documentos):

```javascript
// Ejemplo: total de percepciones tipo 1
{
  $sum: {
    $cond: [
      {
        $or: [
          { $and: [{ $gte: ['$PERCDESC', 1] }, { $lt: ['$PERCDESC', 13] }] },
          { $eq: ['$PERCDESC', 40] },
          { $eq: ['$PERCDESC', 60] }
        ]
      },
      '$IMPORTE',
      0
    ]
  }
}

// Ejemplo: total de deducciones (igual para tipo 1 y tipo 2)
{
  $sum: {
    $cond: [
      {
        $and: [
          { $gte: ['$PERCDESC', 500] },
          { $ne: ['$PERCDESC', 570] }
        ]
      },
      '$IMPORTE',
      0
    ]
  }
}
```

---

## Códigos especiales — referencia rápida

| Código | Nombre habitual | Regla |
|--------|-----------------|-------|
| `40` | (percepción especial) | Siempre percepción, aunque esté en rango 13-499 |
| `60` | (percepción especial) | Siempre percepción, aunque esté en rango 13-499 |
| `570` | (deducción excluida) | No se suma a deducciones aunque `PERCDESC >= 500` |
| `1` | Sueldo / días trabajados | `DIASTRA` en este código se divide entre 8 para obtener días |
| `23` | Prestador de servicios (tipo 2) | `DIASTRA` se muestra sin dividir |
| `6`, `60` | (tipo 2) | `DIASTRA` se muestra sin dividir |

---

## Trampas comunes

- ❌ No comparar con `>` en lugar de `>=` — el rango empieza **en** 1, no en 2
- ❌ No olvidar excluir 40 y 60 del filtro de prestaciones aunque caigan en el rango 13-499
- ❌ No incluir 570 en deducciones — es un código que se ignora siempre
- ❌ El límite superior de percepciones es **diferente** entre tipo 1 (`< 13`) y tipo 2 (`< 24`)
- ✅ Siempre asegurarse de que `PERCDESC` es `Number` (no `String`) — viene como `Number` tras la carga CSV cuando la colección está correctamente registrada en `tablas-conversion-camposnumericos.js`
