// const admin = require('firebase-admin');
// const { getDb } = require('../helpers/mongo.helper');

// exports.enviarNotificacionesRecibos = async (req, res) => {
//     // Recibimos el periodo y el tipo del cuerpo de la petición
//     const { periodo, tipo } = req.body;

//     if (!periodo || !tipo) {
//         return res.status(400).json({ message: 'Se requiere el periodo y el tipo.' });
//     }

//     try {
//         const db = getDb();
//         const collectionName = tipo == 1 ? 'mnom01' : 'mnom01h';
//         const collectionNameRecibos = tipo == 1 ? 'mnom12' : 'mnom12h';

//         // 1. Buscamos todos los empleados que tienen un recibo en ese periodo
//         // (Esta es una forma de hacerlo, ajústala a tu estructura de datos)
//         const empleadosConRecibo = await db.collection(collectionNameRecibos)
//             .find({ PERIODO: periodo })
//             .project({ EMPLEADO: 1 }) // Solo necesitamos el ID del empleado
//             .toArray();

//         const idsDeEmpleados = empleadosConRecibo.map(r => r.EMPLEADO);

//         // 2. Buscamos los tokens de notificación de esos empleados
//         const empleadosConToken = await db.collection(collectionName)
//             .find({ EMPLEADO: { $in: idsDeEmpleados }, fcm_token: { $exists: true } })
//             .project({ fcm_token: 1 })
//             .toArray();

//         if (empleadosConToken.length === 0) {
//             return res.status(200).json({ message: 'No se encontraron empleados con dispositivos registrados para notificar.' });
//         }

//         // 3. Preparamos y enviamos las notificaciones
//         let notificacionesEnviadas = 0;
//         for (const empleado of empleadosConToken) {
//             const message = {
//                 notification: {
//                     title: '¡Recibo de Nómina Disponible!',
//                     body: `Tu recibo del periodo ${periodo} ya está listo para consulta.`
//                 },
//                 token: empleado.fcm_token
//             };

//             try {
//                 await admin.messaging().send(message);
//                 notificacionesEnviadas++;
//             } catch (error) {
//                 // Podrías registrar qué tokens fallaron para limpiarlos después
//                 console.error(`Falló el envío al token: ${empleado.fcm_token}`, error.code);
//             }
//         }

//         res.status(200).json({ message: `Proceso finalizado. Se intentaron enviar ${notificacionesEnviadas} notificaciones.` });

//     } catch (error) {
//         console.error('Error al enviar notificaciones:', error);
//         res.status(500).json({ error: 'Error interno del servidor.' });
//     }
// };

const admin = require('firebase-admin');
const { getDb } = require('../helpers/mongo.helper');

exports.enviarNotificacionesRecibos = async (req, res) => {
    const { periodo, tipo } = req.body;
    // ... (validación de periodo y tipo) ...

    try {
        // Obtenemos las instancias de ambas bases de datos
        const mongoDb = getDb();
        const firestoreDb = admin.firestore();

        const db = getDb();
        const collectionNameRecibos = tipo == 1 ? 'mnom12' : 'mnom12h';

        const empleadosConRecibo = await db.collection(collectionNameRecibos)
            .find({ PERIODO: periodo })
            .project({ EMPLEADO: 1 }) // Solo necesitamos el ID del empleado
            .toArray();

        const idsDeEmpleados = empleadosConRecibo.map(r => r.EMPLEADO);

        if (idsDeEmpleados.length === 0) {
            return res.status(200).json({ message: 'No hay recibos para este periodo.' });
        }

        // 2. Por cada ID, obtenemos el token desde Firestore
        for (const empleadoId of idsDeEmpleados) {
            const tokenRef = firestoreDb.collection('device_tokens').doc(String(empleadoId));
            const doc = await tokenRef.get();

            if (doc.exists && doc.data().fcm_token) {
                const fcmToken = doc.data().fcm_token;
                const message = {
                    notification: {
                        title: '¡Recibo de Nómina Disponible!',
                        body: `Tu recibo del periodo ${periodo} ya está listo para consulta.`
                    }, token: fcmToken
                };

                try {
                    await admin.messaging().send(message);
                } catch (error) {
                    console.error(`Falló el envío al token: ${fcmToken}`, error.code);
                }
            }
        }

        res.status(200).json({ message: 'Proceso de notificación finalizado.' });

    } catch (error) {
        // ... (manejo de errores)
    }
};