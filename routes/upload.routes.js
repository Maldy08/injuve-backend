
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { subirCSV } = require('../controllers/upload.controller');

// Configurar almacenamiento temporal
const upload = multer({ dest: path.join(__dirname, '../uploads') });
/**
 * @swagger
 * /upload/{coleccion}:
 *   post:
 *     summary: Sube un archivo CSV a una colección específica.
 *     description: Este endpoint permite subir un archivo CSV para procesarlo y almacenarlo en una colección específica.
 *     tags:
 *       - Upload
 *     parameters:
 *       - in: path
 *         name: coleccion
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre de la colección donde se almacenará el archivo.
 *         example: "empleados"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               archivo:
 *                 type: string
 *                 format: binary
 *                 description: Archivo CSV a subir.
 *     responses:
 *       200:
 *         description: Archivo subido y procesado correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                   example: "✅ Archivo procesado correctamente"
 *       400:
 *         description: Error en la solicitud (por ejemplo, archivo faltante o formato incorrecto).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ No se proporcionó un archivo válido"
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Error al procesar el archivo"
 */
// POST /api/upload/:coleccion
router.post('/:coleccion', upload.single('archivo'), subirCSV);

module.exports = router;
