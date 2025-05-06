require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jsreport = require('jsreport')({ extensions: { express: { enabled: false } } });
const conectarMongo = require('./helpers/mongo.helper');

// Rutas
const authRoutes = require('./routes/auth.routes');
const uploadRoutes = require('./routes/upload.routes');
const nominaRoutes = require('./routes/nomina.routes');
const pdfRoutes = require('./routes/pdf.routes');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/nomina', nominaRoutes);
app.use('/api/pdf', pdfRoutes);

// Inicialización del servidor con jsreport y MongoDB
jsreport.init().then(() => {
  app.listen(process.env.PORT || 3001, async () => {
    await conectarMongo();
    console.log(`✅ Servidor activo en http://localhost:${process.env.PORT || 3001}`);
  });
}).catch(err => {
  console.error("❌ Error al inicializar jsreport:", err);
});
