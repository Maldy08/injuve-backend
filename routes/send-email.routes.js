const express = require('express');
const router = express.Router();
const { enviarReciboPorCorreo } = require('../controllers/send-email.controller');

/**
 * @swagger
 * /enviar-recibo:
 *   post:
 *     summary: Envía un recibo de nómina por correo electrónico.
 *     description: Este endpoint permite enviar un recibo de nómina en formato PDF al correo electrónico de un empleado.
 *     tags:
 *       - Recibos de Nómina
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               empleado:
 *                 type: string
 *                 description: ID del empleado.
 *                 example: "12345"
 *               periodo:
 *                 type: string
 *                 description: Periodo de nómina.
 *                 example: "2025-05"
 *               correo:
 *                 type: string
 *                 description: Correo electrónico del empleado.
 *                 example: "empleado@ejemplo.com"
 *     responses:
 *       200:
 *         description: Correo enviado correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                   example: "✅ Correo enviado correctamente"
 *       400:
 *         description: Faltan parámetros requeridos.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Faltan parámetros requeridos"
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ No se pudo enviar el correo"
 */
router.post('/enviar-recibo', enviarReciboPorCorreo);

module.exports = router;