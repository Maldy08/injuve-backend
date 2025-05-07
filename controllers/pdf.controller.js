
const path = require('path');
const fs = require('fs');

const getDatosNomina = require('../helpers/get-datos-nomina');
const { initJsReport } = require('../helpers/jsreport.helper');

// GET /api/pdf/:empleado/:periodo
exports.generarPDF = async (req, res) => {
  const empleado = parseInt(req.params.empleado);
  const periodo = parseInt(req.params.periodo);

  if (isNaN(empleado) || isNaN(periodo)) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  try {
    const jsreport = await initJsReport(); 
    const data = await getDatosNomina(empleado, periodo);
    const templateHtml = fs.readFileSync(path.join(__dirname, '../templates/nomina.html')).toString();

    const result = await jsreport.render({
      template: {
        content: templateHtml,
        engine: 'handlebars',
        recipe: 'chrome-pdf'
      },
      data
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=recibo_${empleado}_${periodo}.pdf`);
    result.stream.pipe(res);
  } catch (err) {
    console.error("❌ Error al generar PDF:", err);
    res.status(500).json({ error: "Error al generar el PDF" });
  }
};

