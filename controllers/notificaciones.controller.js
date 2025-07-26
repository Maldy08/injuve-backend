

const admin = require('firebase-admin');
const { getDb } = require('../helpers/mongo.helper');

exports.enviarNotificacionesRecibos = async (req, res) => {
    const { periodo, tipo } = req.body;

    if (!periodo || !tipo) {
        return res.status(400).json({ message: 'Se requiere el periodo y el tipo.' });
    }

    try {
        const firestoreDb = admin.firestore();
        const db = getDb();
        const collectionNameRecibos = tipo == 1 ? 'mnom12' : 'mnom12h';

        // CORRECCIÓN 1: 'distinct' ya devuelve el arreglo de IDs que necesitas.
        const idsDeEmpleados = await db.collection(collectionNameRecibos)
            .distinct("EMPLEADO", { PERIODO: Number(periodo) }); // Asegúrate de que 'periodo' sea un número si así está en tu BD

        if (!idsDeEmpleados || idsDeEmpleados.length === 0) {
            return res.status(200).json({ message: 'No hay recibos para este periodo.' });
        }

        let notificacionesEnviadas = 0;
        // El bucle ahora itera sobre el arreglo correcto de IDs.
        for (const empleadoId of idsDeEmpleados) {
            const tokenRef = firestoreDb.collection('device_tokens').doc(String(empleadoId));
            const doc = await tokenRef.get();

            if (doc.exists && doc.data().fcm_token) {
                const fcmToken = doc.data().fcm_token;
                const message = {
                    notification: {
                        title: '¡Recibo de Nómina Disponible!',
                        body: `Tu recibo del periodo ${periodo} ya está listo.`
                    },
                    data: {
                        // CORRECCIÓN 2: Usa las variables correctas que existen en este scope.
                        'empleadoId': String(empleadoId),
                        'periodo': String(periodo),
                        'tipo': String(tipo)
                    },
                    // CORRECCIÓN 3: Usa la variable fcmToken que obtuviste de Firestore.
                    token: fcmToken
                };

                try {
                    await admin.messaging().send(message);
                    notificacionesEnviadas++;
                } catch (error) {
                    console.error(`Falló el envío al token: ${fcmToken}`, error.code);
                }
            }
        }

        res.status(200).json({ message: `Proceso de notificación finalizado. Se intentaron enviar ${notificacionesEnviadas} notificaciones.` });

    } catch (error) {
        console.error('Error al enviar notificaciones:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};