require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jsreport = require('jsreport')({ extensions: { express: { enabled: false } } });
const conectarMongo = require('./helpers/mongo.helper');

const app = express();

const admin = require('firebase-admin');
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// Middlewares globales
app.use(cors());
app.use(express.json());
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

// Documentación Swagger
const { swaggerUi, specs } = require('./swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

/* ✅ Agrupamos todas las rutas del backend en /api/backend para no interferir con Next.js */
const baseApiPath = '/api/backend';
//
// Rutas del backend
app.use(`${baseApiPath}/auth`, require('./routes/auth.routes'));
app.use(`${baseApiPath}/upload`, require('./routes/upload.routes'));
app.use(`${baseApiPath}/nomina`, require('./routes/nomina.routes'));
app.use(`${baseApiPath}/pdf`, require('./routes/pdf.routes'));
app.use(`${baseApiPath}/send-email`, require('./routes/send-email.routes'));
app.use(`${baseApiPath}/empleados`, require('./routes/empleados.routes'));
app.use(`${baseApiPath}/timbrado`, require('./routes/excel.routes'));
app.use(`${baseApiPath}/bss`, require('./routes/bss.routes'));
app.use(`${baseApiPath}/notificaciones`, require('./routes/notifaciones.routes'));

// Inicialización del servidor con jsreport y MongoDB
jsreport.init().then(() => {
  app.listen(process.env.PORT || 3001, async () => {
    await conectarMongo();
    console.log(`Servidor activo en http://localhost:${process.env.PORT || 3001}`);
  });
}).catch(err => {
  console.error("Error al inicializar jsreport:", err);
});