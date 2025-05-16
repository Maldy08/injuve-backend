const { getDb } = require('../helpers/mongo.helper');

exports.getEmpleados = async (req, res) => {
    const { tipo } = req.params;
    if (tipo !== '1' && tipo !== '2') {
        return res.status(400).json({ error: 'Tipo inválido. Debe ser 1 o 2.' });
    }
    try {
        const db = getDb();

        let empleados;
        if (tipo === '1') {
            empleados = await db.collection('mnom01').find({ VALIDEZ: 'V' }, {
                projection: {
                    _id: 0,
                    EMPLEADO: 1,
                    APPAT: 1,
                    APMAT: 1,
                    NOMBRE: 1,
                    RFC: 1,
                    CURP: 1,
                    EMAIL: 1
                }
            }).sort({ EMPLEADO: 1 }).toArray();
        } else {
            empleados = await db.collection('mnom01h').find({ VALIDEZ: 'V' }, {
                projection: {
                    _id: 0,
                    EMPLEADO: 1,
                    APPAT: 1,
                    APMAT: 1,
                    NOMBRE: 1,
                    RFC: 1,
                    CURP: 1,
                    EMAIL: 1
                }
            }).sort({ EMPLEADO: 1 }).toArray();
        }

        res.json(empleados);
    } catch (error) {
        console.error('Error al obtener empleados:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}


exports.getEmpleadoById = async (req, res) => {
    const { id } = req.params;
    const { tipo } = req.params;
    if (tipo !== '1' && tipo !== '2') {
        return res.status(400).json({ error: 'Tipo inválido. Debe ser 1 o 2.' });
    }
    try {
        const db = getDb();

        let empleado;
        if(tipo ==1) {
             empleado = await db.collection('mnom01').findOne({ EMPLEADO: parseInt(req.params.id) }, { projection: { _id: 0 } });
        }
        else {
             empleado = await db.collection('mnom01h').findOne({ EMPLEADO: parseInt(req.params.id) }, { projection: { _id: 0 } });
        }
        if (empleado) {
          res.json(empleado);
        } else {
          res.status(404).json({ error: 'Empleado no encontrado' });
        }
        
    } catch (error) {
        console.error('Error al obtener empleado:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}
