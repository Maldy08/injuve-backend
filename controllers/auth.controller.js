const jwt = require('jsonwebtoken');
const { getDb } = require('../helpers/mongo.helper');

exports.login = async (req, res) => {
  const { rfc } = req.body;

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
    const admin = accesos.ADMIN;
    if(tipo == 1) {
       empleado = await db.collection('mnom01').findOne({ RFC: rfc.toUpperCase() });
    }
    if(tipo == 2) {
       empleado = await db.collection('mnom01h').findOne({ RFC: rfc.toUpperCase() });
    }

    if (!empleado) {
      return res.status(401).json({ error: 'RFC no encontrado' });
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
        ADMIN: admin,
      }
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
