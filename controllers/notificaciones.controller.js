

const admin = require('firebase-admin');
const { getDb } = require('../helpers/mongo.helper');

exports.enviarNotificacionesRecibos = async (req, res) => {
    const { periodo, tipo } = req.body;
    // ... (validación de periodo y tipo) ...

    try {
        // Obtenemos las instancias de ambas bases de datos

        const firestoreDb = admin.firestore();

        const db = getDb();
        const collectionNameRecibos = tipo == 1 ? 'mnom12' : 'mnom12h';

        // const empleadosConRecibo = await db.collection(collectionNameRecibos)
        //     .find({ PERIODO: periodo })
        //     .project({ EMPLEADO: 1 }) // Solo necesitamos el ID del empleado
        //     .toArray();

        const empleadosConRecibo = await db.collection(collectionNameRecibos)
            .distinct("EMPLEADO", { PERIODO: periodo });

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