// 1. La importación clave: Asegúrate de que apunte a tu helper.
const admin = require('../helpers/firebase.helper.js'); 
const jwt = require('jsonwebtoken');
const { getDb } = require('../helpers/mongo.helper');

exports.login = async (req, res) => {
  const { rfc, fcmToken } = req.body;

  if (!rfc) {
    return res.status(400).json({ error: 'RFC requerido' });
  }

  try {
    let empleado;
    const db = getDb();
    const accesos = await db.collection('accesos').findOne({ RFC: rfc.toUpperCase() });
    if (!accesos) {
      return res.status(401).json({ error: 'Acceso no autorizado' });
    }

    const tipo = accesos.TIPO;
    const isAdmin = accesos.ADMIN; // Renombrada para evitar conflicto con la variable 'admin' de Firebase
    let collectionName;

    if (tipo == 1) {
      collectionName = 'mnom01';
      empleado = await db.collection(collectionName).findOne({ RFC: rfc.toUpperCase() });
    }
    if (tipo == 2) {
      collectionName = 'mnom01h';
      empleado = await db.collection(collectionName).findOne({ RFC: rfc.toUpperCase() });
    }

    if (!empleado) {
      return res.status(401).json({ error: 'RFC no encontrado' });
    }

    // Esta sección ahora funcionará porque 'admin' está correctamente definido.
    if (fcmToken) {
      const db = admin.firestore();
      const tokenRef = db.collection('device_tokens').doc(String(empleado.EMPLEADO));

      await tokenRef.set({
        fcm_token: fcmToken,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Token FCM guardado en Firestore para el empleado ${empleado.EMPLEADO}`);
    }

    const token = jwt.sign(
      {
        EMPLEADO: empleado.EMPLEADO,
        RFC: empleado.RFC,
        NOMBRE: empleado.NOMBRE,
      },
      process.env.SECRET_KEY,
      { expiresIn: '4h' }
    );

    res.json({
      token,
      empleado: {
        EMPLEADO: empleado.EMPLEADO,
        NOMBRE: empleado.NOMBRE,
        APPAT: empleado.APPAT,
        APMAT: empleado.APMAT,
        RFC: empleado.RFC,
        CURP: empleado.CURP,
        TIPO: accesos.TIPO,
        EMAIL: empleado.EMAIL,
        ADMIN: isAdmin,
      }
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};