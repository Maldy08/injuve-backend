const getDatosNomina = require('../helpers/get-datos-nomina');
const { initJsReport } = require('../helpers/jsreport.helper');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../helpers/mongo.helper');

exports.enviarRecibosPorCorreo = async (req, res) => {
  const { periodo, tipo } = req.body;
  if (!periodo || !tipo) {
    return res.status(400).json({ error: "Faltan parámetros requeridos" });
  }

  // Configura SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const jsreport = await initJsReport();
    const db = getDb();
    const collectionName = tipo === 1 ? 'mnom12' : 'mnom12h';
    const empleadosData = await db.collection(collectionName).find({ PERIODO: periodo }).toArray();
    const empleadosUnicos = empleadosData.filter(
      (value, index, self) => index === self.findIndex((e) => e.EMPLEADO === value.EMPLEADO)
    ).slice(0, 10);

    const correosCollection = tipo === 1 ? 'mnom01' : 'mnom01h';
    const empleadosConCorreos = await Promise.all(
      empleadosUnicos.map(async (empleado) => {
        const correoData = await db.collection(correosCollection).findOne({ EMPLEADO: empleado.EMPLEADO });
        return {
          ...empleado,
          CORREO: correoData ? correoData.EMAIL : null,
        };
      })
    );
    const empleadosFiltrados = empleadosConCorreos.filter((empleado) => empleado.CORREO);

    const template = tipo === 1 ? "nomina" : "nomina-asim";
    const templateHtml = fs.readFileSync(path.join(__dirname, `../templates/${template}.html`)).toString();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    let enviados = 0;
    for (const empleado of empleadosFiltrados) {
      const { EMPLEADO, CORREO } = empleado;
      const data = await getDatosNomina(EMPLEADO, periodo, tipo);
      const result = await jsreport.render({
        template: {
          content: templateHtml,
          engine: "handlebars",
          recipe: "chrome-pdf"
        },
        data
      });
      await transporter.sendMail({
        from: `"Nómina Injuve" <${process.env.EMAIL_USER}>`,
        to: CORREO,
        subject: `Recibo de Nómina - Periodo ${periodo}`,
        text: `Adjunto se encuentra su recibo de nómina correspondiente al periodo ${periodo}.`,
        attachments: [
          {
            filename: `empleado_${EMPLEADO}_${periodo}.pdf`,
            content: result.content
          }
        ]
      });
      enviados++;
      // Envía el progreso al frontend
      res.write(`data: ${JSON.stringify({ progreso: enviados, total: empleadosFiltrados.length })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ mensaje: "✅ Correos enviados correctamente", done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Error al enviar correos:", error);
    res.write(`data: ${JSON.stringify({ error: "❌ No se pudo enviar el correo", done: true })}\n\n`);
    res.end();
  }
};


exports.enviarReciboPorCorreo = async (req, res) => {
  const { empleado, periodo, correo, tipo } = req.body;

  if (!empleado || !periodo || !correo || !tipo) {
    return res.status(400).json({ error: "Faltan parámetros requeridos" });
  }

  try {
    const jsreport = await initJsReport();
    const data = await getDatosNomina(empleado, periodo, tipo);
    const template = tipo == 1 ? "nomina" : "nomina-asim";
    const templateHtml = fs.readFileSync(path.join(__dirname, `../templates/${template}.html`)).toString();

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