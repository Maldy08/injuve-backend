const jwt = require('jsonwebtoken');
const { getDb } = require('../helpers/mongo.helper');

exports.login = async (req, res) => {
  const { rfc } = req.body;

  if (!rfc) {
    return res.status(400).json({ error: 'RFC requerido' });
  }

  try {
    const db = getDb();
    const empleado = await db.collection('mnom01').findOne({ RFC: rfc.toUpperCase() });

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
        CURP: empleado.CURP
      }
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
