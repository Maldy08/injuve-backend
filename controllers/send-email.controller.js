const getDatosNomina = require('../helpers/get-datos-nomina');
const { initJsReport } = require('../helpers/jsreport.helper');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

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

exports.enviarReciboPorCorreo = async (req, res) => {
    const { empleado, periodo, correo } = req.body;
  
    if (!empleado || !periodo || !correo) {
      return res.status(400).json({ error: "Faltan parámetros requeridos" });
    }
  
    try {
      const jsreport = await initJsReport(); 
      const data = await getDatosNomina(empleado, periodo);
      const templateHtml = fs.readFileSync(path.join(__dirname, "../templates/nomina.html")).toString();
  
      const result = await jsreport.render({
        template: {
          content: templateHtml,
          engine: "handlebars",
          recipe: "chrome-pdf"
        },
        data
      });
  
      // Configuración de nodemailer con SMTP (ejemplo Gmail)
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
  
      await transporter.sendMail({
        from: `"Nómina Injuve" <${process.env.EMAIL_USER}>`,
        to: correo,
        subject: `Recibo de Nómina - Periodo ${periodo}`,
        text: `Adjunto se encuentra su recibo de nómina correspondiente al periodo ${periodo}.`,
        attachments: [
          {
            filename: `recibo_${empleado}_${periodo}.pdf`,
            content: result.content
          }
        ]
      });
  
      res.json({ mensaje: "✅ Correo enviado correctamente" });
    } catch (error) {
      console.error("Error al enviar correo:", error);
      res.status(500).json({ error: "❌ No se pudo enviar el correo" });
    }
  };