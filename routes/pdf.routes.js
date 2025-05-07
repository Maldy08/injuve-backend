
const express = require('express');
const router = express.Router();
const { generarPDF } = require('../controllers/pdf.controller');

/**
 * @swagger
 * /pdf/{empleado}/{periodo}:
 *   get:
 *     summary: Genera un archivo PDF de un recibo de nómina.
 *     description: Este endpoint genera y devuelve un archivo PDF correspondiente al recibo de nómina de un empleado para un periodo específico.
 *     tags:
 *       - PDF
 *     parameters:
 *       - in: path
 *         name: empleado
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del empleado para el cual se generará el PDF.
 *         example: "12345"
 *       - in: path
 *         name: periodo
 *         required: true
 *         schema:
 *           type: string
 *         description: Periodo de nómina para el cual se generará el PDF.
 *         example: "2025-05"
 *     responses:
 *       200:
 *         description: PDF generado correctamente.
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Error en la solicitud (por ejemplo, parámetros faltantes o inválidos).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Parámetros inválidos"
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Error al generar el PDF"
 */
router.get('/:empleado/:periodo', generarPDF);

module.exports = router;
