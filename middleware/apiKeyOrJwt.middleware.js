// middleware/apiKeyOrJwt.middleware.js

const jwt = require('jsonwebtoken');

const apiKeyOrJwtMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  // Si el header x-api-key existe y coincide con el secreto del servidor → acceso de agente
  if (apiKey && process.env.API_KEY_AGENTE && apiKey === process.env.API_KEY_AGENTE) {
    return next();
  }

  // Si no, continuar con la validación normal de JWT
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ message: 'Acceso denegado. No se proporcionó un token.' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Acceso denegado. Formato de token inválido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ message: 'Token no válido o expirado.' });
  }
};

module.exports = apiKeyOrJwtMiddleware;
