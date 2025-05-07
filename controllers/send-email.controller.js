const getDatosNomina = require('../helpers/get-datos-nomina');
const { initJsReport } = require('../helpers/jsreport.helper');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');



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