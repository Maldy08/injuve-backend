const jwt = require('jsonwebtoken');
const { getDb } = require('../helpers/mongo.helper');

exports.getProfile = async (req, res) => {

  const empleadoId = req.user.userId;

  try {
    const db = getDb();
    const user = await db.collection('usuarios').findOne({ EMPLEADO: empleadoId });

    if (!user) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    let empleado = null;
    if (user.TIPO === 1) {
      empleado = await db.collection('mnom01').findOne({ EMPLEADO: empleadoId });
    } else if (user.TIPO === 2) {
      empleado = await db.collection('mnom01h').findOne({ EMPLEADO: empleadoId });
    }


    res.json({
      EMPLEADO: empleado.EMPLEADO,
      NOMBRE: empleado.NOMBRE,
      APPAT: empleado.APPAT,
      APMAT: empleado.APMAT,
      RFC: empleado.RFC,
      CURP: empleado.CURP,
      TIPO: user.TIPO,
      EMAIL: user.CORREO,
    });
  } catch (err) {
    console.error("Error al obtener el perfil:", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}



exports.loginMobile = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const db = getDb();
    const user = await db.collection('usuarios').findOne({ CORREO: email });

    if (!user || user.PASSWORD !== password) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    let empleado = null;
    if (user.TIPO === 1) {
      empleado = await db.collection('mnom01').findOne({ EMAIL: email });
    } else if (user.TIPO === 2) {
      empleado = await db.collection('mnom01h').findOne({ EMAIL: email });
    }

    // Puedes agregar validación si no se encuentra el empleado
    if (!empleado) {
      return res.status(404).json({ error: 'Empleado no encontrado en la colección correspondiente' });
    }

    const deptoData = user.TIPO == 1 ? await db.collection('mnom04').findOne({ DEPTO: empleado.DEPTO }) : null;
    const puestoData = user.TIPO == 1 ? await db.collection('mnom03').findOne({ CATEGORIA: empleado.CAT }) : null;
    const accesos = await db.collection('accesos').findOne({ RFC: empleado.RFC.toUpperCase() });
    let admin = 0;

    if(accesos) {
      if(accesos.ADMIN === 1) {
        admin = 1;
      }
    }


    const token = jwt.sign(
      { userId: user.EMPLEADO, email: user.CORREO },
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
        TIPO: user.TIPO,
        EMAIL: user.CORREO,
        DEPARTAMENTO: deptoData ? deptoData.DESCRIPCION : 'No asignado',
        PUESTO: puestoData ? puestoData.DESCRIPCION : 'No asignado',
        NIVEL: empleado.NIVEL,
        ISSTECALI: empleado.REGIMSS,
        ADMIN: admin,
      }
    });
  } catch (err) {
    console.error("Error en loginMobile:", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }

}


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
    const isAdmin = accesos.ADMIN;
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


