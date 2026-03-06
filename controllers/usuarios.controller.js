const { getDb } = require('../helpers/mongo.helper');

// Obtener todos los usuarios
exports.getUsuarios = async (req, res) => {
    try {
        const db = getDb();
        const usuarios = await db.collection('usuarios').find({}, {
            projection: {
                PASSWORD: 0 // No mostrar la contraseña en el listado
            }
        }).sort({ EMPLEADO: 1 }).toArray();
        res.json(usuarios);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Obtener un usuario por ID de empleado
exports.getUsuarioById = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        const usuario = await db.collection('usuarios').findOne(
            { EMPLEADO: parseInt(id) },
            { projection: { PASSWORD: 0 } } // No mostrar la contraseña
        );
        
        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(usuario);
    } catch (error) {
        console.error('Error al obtener el usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Crear un nuevo usuario
exports.createUsuario = async (req, res) => {
    const { EMPLEADO, NOMBRE, CORREO, PASSWORD, TIPO } = req.body;
    
    // Validaciones
    if (!EMPLEADO || !NOMBRE || !CORREO || !PASSWORD || TIPO === undefined) {
        return res.status(400).json({ 
            error: 'EMPLEADO, NOMBRE, CORREO, PASSWORD y TIPO son requeridos' 
        });
    }

    // Validar que TIPO sea 1 o 2
    if (TIPO !== 1 && TIPO !== 2) {
        return res.status(400).json({ 
            error: 'TIPO debe ser 1 (Base) o 2 (Honorarios)' 
        });
    }

    try {
        const db = getDb();
        
        // Verificar si ya existe un usuario con ese EMPLEADO
        const existingEmpleado = await db.collection('usuarios').findOne({ 
            EMPLEADO: parseInt(EMPLEADO) 
        });
        if (existingEmpleado) {
            return res.status(400).json({ error: 'Ya existe un usuario con este número de empleado' });
        }

        // Verificar si ya existe un usuario con ese CORREO
        const existingCorreo = await db.collection('usuarios').findOne({ CORREO });
        if (existingCorreo) {
            return res.status(400).json({ error: 'Ya existe un usuario con este correo' });
        }

        // Insertar el nuevo usuario
        const result = await db.collection('usuarios').insertOne({
            EMPLEADO: parseInt(EMPLEADO),
            NOMBRE,
            CORREO,
            PASSWORD,
            TIPO: parseInt(TIPO)
        });
        
        res.status(201).json({ 
            message: 'Usuario creado exitosamente', 
            id: result.insertedId 
        });
    } catch (error) {
        console.error('Error al crear el usuario:', error);
        // Manejo de error de índice único de MongoDB
        if (error.code === 11000) {
            return res.status(400).json({ 
                error: 'Ya existe un usuario con este número de empleado o correo' 
            });
        }
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Actualizar un usuario existente
exports.updateUsuario = async (req, res) => {
    const { id } = req.params;
    const { NOMBRE, CORREO, PASSWORD, TIPO } = req.body;

    // Validar que al menos un campo esté presente
    if (!NOMBRE && !CORREO && !PASSWORD && TIPO === undefined) {
        return res.status(400).json({ 
            error: 'Debe proporcionar al menos un campo para actualizar' 
        });
    }

    try {
        const db = getDb();
        
        // Verificar si el usuario existe
        const usuarioExistente = await db.collection('usuarios').findOne({ 
            EMPLEADO: parseInt(id) 
        });
        
        if (!usuarioExistente) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Construir el objeto de actualización
        const updateData = {};
        if (NOMBRE) updateData.NOMBRE = NOMBRE;
        if (CORREO) {
            // Verificar que el correo no esté siendo usado por otro usuario
            const correoExistente = await db.collection('usuarios').findOne({ 
                CORREO,
                EMPLEADO: { $ne: parseInt(id) }
            });
            if (correoExistente) {
                return res.status(400).json({ 
                    error: 'El correo ya está siendo utilizado por otro usuario' 
                });
            }
            updateData.CORREO = CORREO;
        }
        if (PASSWORD) updateData.PASSWORD = PASSWORD;
        if (TIPO !== undefined) {
            if (TIPO !== 1 && TIPO !== 2) {
                return res.status(400).json({ 
                    error: 'TIPO debe ser 1 (Base) o 2 (Honorarios)' 
                });
            }
            updateData.TIPO = parseInt(TIPO);
        }

        // Actualizar el usuario
        const result = await db.collection('usuarios').updateOne(
            { EMPLEADO: parseInt(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ message: 'Usuario actualizado exitosamente' });
    } catch (error) {
        console.error('Error al actualizar el usuario:', error);
        // Manejo de error de índice único de MongoDB
        if (error.code === 11000) {
            return res.status(400).json({ 
                error: 'El correo ya está siendo utilizado por otro usuario' 
            });
        }
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Eliminar un usuario
exports.deleteUsuario = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        const result = await db.collection('usuarios').deleteOne({ 
            EMPLEADO: parseInt(id) 
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar el usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
