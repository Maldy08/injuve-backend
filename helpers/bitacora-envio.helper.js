const { getDb } = require('./mongo.helper');

const COLECCION = 'bitacora_envio_recibos';

// Persiste un registro de error al intentar enviar un recibo por correo.
// Las escrituras son best-effort: si Mongo está caído o falla la inserción,
// se loguea a consola pero NO se propaga la excepción para no romper el flujo
// del envío (el error original ya fue manejado por el caller).
//
// Campos:
//   empleado:  número del empleado (puede ser null si el error es a nivel batch).
//   correo:    correo destino (puede ser null si nunca se resolvió).
//   periodo:   número del periodo de nómina.
//   tipo:      1 (base/confianza) o 2 (honorarios).
//   modo:      "individual" | "masivo" | "critico_masivo".
//   paso:      etiqueta del paso donde falló (ver constantes abajo).
//   mensaje:   texto del error.
//   fecha:     timestamp ISO del registro.
async function registrarError({ empleado, correo, periodo, tipo, modo, paso, mensaje }) {
  try {
    const db = getDb();
    await db.collection(COLECCION).insertOne({
      empleado: empleado !== undefined ? empleado : null,
      correo: correo || null,
      periodo: periodo !== undefined && periodo !== null ? Number(periodo) : null,
      tipo: tipo !== undefined && tipo !== null ? Number(tipo) : null,
      modo: modo || 'desconocido',
      paso: paso || 'desconocido',
      mensaje: mensaje || 'Error sin mensaje',
      fecha: new Date()
    });
  } catch (err) {
    console.error('⚠️ No se pudo guardar el error en bitacora_envio_recibos:', err.message);
  }
}

// Etiquetas estandarizadas para el campo `paso`.
const PASOS = Object.freeze({
  INICIALIZACION_JSREPORT: 'inicializacion_jsreport',
  OBTENER_DATOS_NOMINA: 'obtener_datos_nomina',
  LEER_PLANTILLA: 'leer_plantilla',
  GENERAR_PDF: 'generar_pdf',
  ENVIAR_CORREO: 'enviar_correo',
  PROCESO_GENERAL: 'proceso_general',
  ENVIO_MASIVO: 'envio_masivo',
  CRITICO_MASIVO: 'critico_masivo'
});

module.exports = { registrarError, PASOS, COLECCION };
