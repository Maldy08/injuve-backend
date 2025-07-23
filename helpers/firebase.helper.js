const admin = require('firebase-admin');
const path = require('path'); // 1. Importa el módulo 'path'
require('dotenv').config();

// 2. Construye una ruta absoluta al archivo de credenciales
const serviceAccountPath = path.join(__dirname, '..', process.env.SERVICE_ACCOUNT_FILE);

if (!serviceAccountPath) {
  throw new Error("La variable de entorno SERVICE_ACCOUNT_FILE no está definida.");
}

const serviceAccount = require(serviceAccountPath);

// Inicializa la app de Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log("Firebase Admin SDK inicializado exitosamente.");

module.exports = admin;