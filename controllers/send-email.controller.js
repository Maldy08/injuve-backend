const getDatosNomina = require('../helpers/get-datos-nomina');
const { initJsReport } = require('../helpers/jsreport.helper');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../helpers/mongo.helper');

exports.enviarRecibosPorCorreo = async (req, res) => {
  const { periodo, tipo } = req.query;
  if (!periodo || !tipo) {
    return res.status(400).json({ error: "Faltan parámetros requeridos" });
  }

  // Configura SSE para enviar progreso al frontend
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const jsreport = await initJsReport();
    const db = getDb();

    // Obtener empleados según el tipo
    const collectionName = Number(tipo) === 1 ? 'mnom12' : 'mnom12h';
    const empleadosData = await db.collection(collectionName).find({ PERIODO: Number(periodo) }).toArray();

    // Filtrar empleados únicos
    const empleadosUnicos = empleadosData.filter(
      (value, index, self) => index === self.findIndex((e) => e.EMPLEADO === value.EMPLEADO)
    );

    // Obtener correos de la tabla correspondiente (mnom01 o mnom01h)
    const correosCollection = Number(tipo) === 1 ? 'mnom01' : 'mnom01h';
    const empleadosConCorreos = await Promise.all(
      empleadosUnicos.map(async (empleado) => {
        const correoData = await db.collection(correosCollection).findOne({ EMPLEADO: empleado.EMPLEADO });
        return {
          ...empleado,
          CORREO: correoData ? correoData.EMAIL : 'camv29@gmail.com',
         // CORREO: "camv29@gmail.com"
        };
      })
    );

    // Filtrar empleados que no tienen correo
    const empleadosFiltrados = empleadosConCorreos.filter((empleado) => empleado.CORREO);

    // Leer la plantilla correspondiente
    const template = Number(tipo) === 1 ? "nomina" : "nomina-asim";
    const templateHtml = fs.readFileSync(path.join(__dirname, `../templates/${template}.html`)).toString();

    // Configuración de nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    let enviados = 0;
    let fallidos = 0;
    const total = empleadosFiltrados.length;
    const bitacoraErrores = []; // Bitácora de empleados con error

    for (const empleado of empleadosFiltrados) {
      const { EMPLEADO, CORREO } = empleado;

      try {
        // Obtener datos de nómina para el empleado
        const data = await getDatosNomina(EMPLEADO, Number(periodo), Number(tipo));

        // Generar el PDF con jsreport
        const result = await jsreport.render({
          template: {
            content: templateHtml,
            engine: "handlebars",
            recipe: "chrome-pdf"
          },
          data
        });

        // Enviar el correo
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
        console.log(`✅ Correo enviado a empleado ${EMPLEADO} (${CORREO}) - ${enviados}/${total}`);
        
        // Envía el progreso al frontend
        res.write(`data: ${JSON.stringify({ 
          progreso: enviados + fallidos, 
          total, 
          enviados,
          fallidos,
          empleadoActual: EMPLEADO
        })}\n\n`);

      } catch (error) {
        fallidos++;
        const errorInfo = {
          empleado: EMPLEADO,
          correo: CORREO,
          error: error.message || 'Error desconocido',
          fecha: new Date().toISOString()
        };
        bitacoraErrores.push(errorInfo);
        
        console.error(`❌ Error al enviar correo a empleado ${EMPLEADO} (${CORREO}):`, error.message);
        
        // Envía el progreso incluyendo el error actual
        res.write(`data: ${JSON.stringify({ 
          progreso: enviados + fallidos, 
          total, 
          enviados,
          fallidos,
          empleadoActual: EMPLEADO,
          errorEmpleado: errorInfo
        })}\n\n`);
      }
    }

    // Proceso terminado - enviar resumen final
    const mensajeFinal = enviados === total 
      ? `✅ Todos los correos fueron enviados correctamente (${enviados}/${total})`
      : `⚠️ Proceso completado: ${enviados} enviados, ${fallidos} fallidos de ${total} total`;

    res.write(`data: ${JSON.stringify({ 
      mensaje: mensajeFinal,
      resumen: {
        total,
        enviados,
        fallidos,
        bitacoraErrores
      },
      finalizado: true
    })}\n\n`);
    res.end();
  } catch (error) {
    console.error('❌ Error crítico en el proceso de envío de correos:', error);
    res.write(`data: ${JSON.stringify({ 
      error: "❌ Error crítico: " + (error.message || "No se pudo completar el proceso"),
      finalizado: true
    })}\n\n`);
    res.end();
  }
};
// exports.enviarRecibosPorCorreo = async (req, res) => {
//   const { periodo, tipo } = req.query;

//   if (!periodo || !tipo) {
//     return res.status(400).json({ error: "Faltan parámetros requeridos" });
//   }

//   // Configura SSE para enviar progreso al frontend
//   res.setHeader('Content-Type', 'text/event-stream');
//   res.setHeader('Cache-Control', 'no-cache');
//   res.setHeader('Connection', 'keep-alive');
//   res.flushHeaders();

//   try {
//     // SIMULACIÓN DE EMPLEADOS PARA PRUEBA
//     const empleadosFiltrados = [
//       { EMPLEADO: 1, CORREO: "prueba1@correo.com" },
//       { EMPLEADO: 2, CORREO: "prueba2@correo.com" },
//       { EMPLEADO: 3, CORREO: "prueba3@correo.com" },
//       { EMPLEADO: 4, CORREO: "prueba4@correo.com" },
//       { EMPLEADO: 5, CORREO: "prueba5@correo.com" },
//       { EMPLEADO: 1, CORREO: "prueba1@correo.com" },
//       { EMPLEADO: 2, CORREO: "prueba2@correo.com" },
//       { EMPLEADO: 3, CORREO: "prueba3@correo.com" },
//       { EMPLEADO: 4, CORREO: "prueba4@correo.com" },
//       { EMPLEADO: 5, CORREO: "prueba5@correo.com" },
//       { EMPLEADO: 1, CORREO: "prueba1@correo.com" },
//       { EMPLEADO: 2, CORREO: "prueba2@correo.com" },
//       { EMPLEADO: 3, CORREO: "prueba3@correo.com" },
//       { EMPLEADO: 4, CORREO: "prueba4@correo.com" },
//       { EMPLEADO: 5, CORREO: "prueba5@correo.com" },
//       { EMPLEADO: 1, CORREO: "prueba1@correo.com" },
//       { EMPLEADO: 2, CORREO: "prueba2@correo.com" },
//       { EMPLEADO: 3, CORREO: "prueba3@correo.com" },
//       { EMPLEADO: 4, CORREO: "prueba4@correo.com" },
//       { EMPLEADO: 5, CORREO: "prueba5@correo.com" },
//       { EMPLEADO: 1, CORREO: "prueba1@correo.com" },
//       { EMPLEADO: 2, CORREO: "prueba2@correo.com" },
//       { EMPLEADO: 3, CORREO: "prueba3@correo.com" },
//       { EMPLEADO: 4, CORREO: "prueba4@correo.com" },
//       { EMPLEADO: 5, CORREO: "prueba5@correo.com" }
//     ];

//     // Puedes comentar o eliminar las líneas de consulta real a la base de datos

//     // Simula el envío de correos y el progreso
//     let enviados = 0;
//     const total = empleadosFiltrados.length;

//     for (const empleado of empleadosFiltrados) {
//       // Simula espera (por ejemplo, 1 segundo)
//       await new Promise(resolve => setTimeout(resolve, 1000));

//       enviados++;
//       console.log('Progreso:', enviados, 'de', total);
//       res.write(`data: ${JSON.stringify({ progreso: enviados, total })}\n\n`);
//     }

//     // Proceso terminado
//     res.write(`data: ${JSON.stringify({ mensaje: "✅ Correos enviados correctamente" })}\n\n`);
//     res.end();
//   } catch (error) {
//     res.write(`data: ${JSON.stringify({ error: "❌ No se pudo enviar el correo" })}\n\n`);
//     res.end();
//   }
// };


exports.enviarReciboPorCorreo = async (req, res) => {
  const { empleado, periodo, correo, tipo } = req.body;

  if (!empleado || !periodo || !correo || !tipo) {
    return res.status(400).json({ 
      error: "Faltan parámetros requeridos",
      detalles: { empleado, periodo, correo, tipo }
    });
  }

  try {
    console.log(`📧 Iniciando envío de correo a empleado ${empleado} (${correo}) - Periodo ${periodo}`);

    // Inicializar jsreport
    let jsreport;
    try {
      jsreport = await initJsReport();
    } catch (error) {
      console.error(`❌ Error al inicializar jsreport para empleado ${empleado}:`, error.message);
      return res.status(500).json({ 
        error: "Error al inicializar el generador de PDF",
        detalles: error.message,
        empleado,
        paso: "inicialización_jsreport"
      });
    }

    // Obtener datos de nómina
    let data;
    try {
      data = await getDatosNomina(empleado, periodo, tipo);
      if (!data) {
        throw new Error("No se encontraron datos de nómina para este empleado");
      }
    } catch (error) {
      console.error(`❌ Error al obtener datos de nómina para empleado ${empleado}:`, error.message);
      return res.status(404).json({ 
        error: "No se encontraron datos de nómina",
        detalles: error.message,
        empleado,
        periodo,
        paso: "obtener_datos_nomina"
      });
    }

    // Leer plantilla
    const template = tipo == 1 ? "nomina" : "nomina-asim";
    let templateHtml;
    try {
      templateHtml = fs.readFileSync(path.join(__dirname, `../templates/${template}.html`)).toString();
    } catch (error) {
      console.error(`❌ Error al leer plantilla ${template} para empleado ${empleado}:`, error.message);
      return res.status(500).json({ 
        error: "Error al leer la plantilla del PDF",
        detalles: error.message,
        empleado,
        template,
        paso: "leer_plantilla"
      });
    }

    // Generar PDF
    let result;
    try {
      result = await jsreport.render({
        template: {
          content: templateHtml,
          engine: "handlebars",
          recipe: "chrome-pdf"
        },
        data
      });
    } catch (error) {
      console.error(`❌ Error al generar PDF para empleado ${empleado}:`, error.message);
      return res.status(500).json({ 
        error: "Error al generar el PDF",
        detalles: error.message,
        empleado,
        paso: "generar_pdf"
      });
    }

    // Configurar transporter de correo
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Enviar correo
    try {
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
    } catch (error) {
      console.error(`❌ Error al enviar correo a empleado ${empleado} (${correo}):`, error.message);
      return res.status(500).json({ 
        error: "Error al enviar el correo electrónico",
        detalles: error.message,
        empleado,
        correo,
        paso: "enviar_correo"
      });
    }

    console.log(`✅ Correo enviado exitosamente a empleado ${empleado} (${correo})`);
    res.json({ 
      mensaje: "✅ Correo enviado correctamente",
      empleado,
      correo,
      periodo
    });

  } catch (error) {
    console.error(`❌ Error inesperado al enviar correo a empleado ${empleado}:`, error);
    res.status(500).json({ 
      error: "❌ Error inesperado al procesar la solicitud",
      detalles: error.message || "Error desconocido",
      empleado,
      correo,
      periodo,
      paso: "proceso_general"
    });
  }
};