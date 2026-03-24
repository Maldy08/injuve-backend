require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jsreport = require('jsreport')({ extensions: { express: { enabled: false } } });
const conectarMongo = require('./helpers/mongo.helper');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

const compression = require('compression');
app.use(compression({
  filter: (req, res) => {
    if (req.headers.accept && req.headers.accept === 'text/event-stream') {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Documentaci�n Swagger
const { swaggerUi, specs } = require('./swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

/* Agrupamos todas las rutas del backend en /api/backend para no interferir con Next.js */
const baseApiPath = '/api/backend';
const authMiddleware = require('./middleware/auth.middleware');
const apiKeyOrJwtMiddleware = require('./middleware/apiKeyOrJwt.middleware');

// Rutas públicas (no requieren token)
app.use(`${baseApiPath}/auth`, require('./routes/auth.routes'));

// Rutas de upload: aceptan x-api-key de agente automatizado O token JWT válido
app.use(`${baseApiPath}/upload`, apiKeyOrJwtMiddleware, require('./routes/upload.routes'));

// Protección JWT global — todas las rutas registradas después de esta línea requieren token válido
app.use(authMiddleware);

// Rutas protegidas
app.use(`${baseApiPath}/home`, require('./routes/home.routes'));
app.use(`${baseApiPath}/nomina`, require('./routes/nomina.routes'));
app.use(`${baseApiPath}/pdf`, require('./routes/pdf.routes'));
app.use(`${baseApiPath}/send-email`, require('./routes/send-email.routes'));
app.use(`${baseApiPath}/empleados`, require('./routes/empleados.routes'));
app.use(`${baseApiPath}/timbrado`, require('./routes/excel.routes'));
app.use(`${baseApiPath}/bss`, require('./routes/bss.routes'));
app.use(`${baseApiPath}/puestos`, require('./routes/puestos.routes'));
app.use(`${baseApiPath}/categorias`, require('./routes/categorias.routes'));
app.use(`${baseApiPath}/niveles`, require('./routes/niveles.routes'));
app.use(`${baseApiPath}/nivelesconfianza`, require('./routes/nivelesconfianza.routes'));
app.use(`${baseApiPath}/sueldoprestacionesbase`, require('./routes/sueldoprestacionesbase.routes'));
app.use(`${baseApiPath}/sueldoprestacionesconf`, require('./routes/sueldoprestacionesconf.routes'));
app.use(`${baseApiPath}/usuarios`, require('./routes/usuarios.routes'));

// Inicializaci�n del servidor con jsreport y MongoDB
jsreport.init().then(() => {
  app.listen(process.env.PORT || 3001, async () => {
    await conectarMongo();
    console.log(`Servidor activo en http://localhost:${process.env.PORT || 3001}`);
  });
}).catch(err => {
  console.error('Error al inicializar jsreport:', err);
});
