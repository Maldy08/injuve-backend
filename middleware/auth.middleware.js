// middleware/auth.middleware.js

const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // 1. Busca el token en la cabecera 'Authorization'
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    // Si no hay cabecera, no hay acceso
    return res.status(401).json({ message: 'Acceso denegado. No se proporcionó un token.' });
  }

  // El formato del token es "Bearer <token>"
  const token = authHeader.split(' ')[1];

  if (!token) {
    // Si no hay token después de 'Bearer', no hay acceso
    return res.status(401).json({ message: 'Acceso denegado. Formato de token inválido.' });
  }

  try {
    // 2. Verifica que el token sea válido usando tu clave secreta
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
 console.log('Token decodificado en middleware:', decoded);
    // 3. Si es válido, añade los datos del usuario al objeto 'req'
    req.user = decoded; // Ahora 'req.user' tendrá { EMPLEADO, RFC, NOMBRE }

    // 4. Llama a 'next()' para pasar a la siguiente función (el controlador)
    next();
  } catch (error) {
    // Si el token no es válido (expirado, malformado, etc.)
    res.status(403).json({ message: 'Token no válido o expirado.' });
  }
};

module.exports = authMiddleware;