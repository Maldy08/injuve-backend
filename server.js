const express = require("express");
const fs = require("fs");
const jsreport = require("jsreport")({ extensions: { express: { enabled: false } } });
const path = require("path");
const multer = require('multer');
const csv = require('csv-parser');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const mongoUrl = process.env.MONGO_URI;
const SECRET_KEY = process.env.SECRET_KEY;
const { MongoClient } = require("mongodb");

const numeroALetras = require('./helpers/numeros-letras');
const formatearFechaTexto = require('./helpers/formatear-fecha-texto');


const app = express();
const cors = require('cors');

const dbName = "injuve";
const colConceptos = "mnom12";
const colEmpleados = "mnom01";


app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json());

// Asegura que la carpeta 'uploads' exista
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const upload = multer({ dest: 'uploads/' });

// POST /upload/:coleccion — Recibe archivo CSV y lo guarda en MongoDB
app.post('/upload/:coleccion', upload.single('archivo'), async (req, res) => {
  const coleccion = req.params.coleccion;
  const archivoCSV = req.file;

  if (!archivoCSV) {
    return res.status(400).send('No se envió archivo');
  }

  const registros = [];

  fs.createReadStream(archivoCSV.path)
    .pipe(csv({ separator: ',' }))
    .on('data', (row) => {
      // Campos que deseas convertir a número
      const camposNumericos = [
        'EMPLEADO', 'PERIODO', 'PERCDESC', 'IMPORTE',
        'TIPONOM', 'RECIBO', 'DIASTRA', 'NIVEL', 'CLUES'
      ];

      camposNumericos.forEach((campo) => {
        if (row[campo]) {
          const num = Number(row[campo].replace(/,/g, ''));
          if (!isNaN(num)) row[campo] = num;
        }
      });

      registros.push(row);
    })
    .on('end', async () => {
      try {
        const client = new MongoClient(mongoUrl);
        await client.connect();
        const db = client.db(dbName);
        await db.collection(coleccion).insertMany(registros);

        fs.unlinkSync(archivoCSV.path); // Limpia el archivo temporal

        res.send(`✅ ${registros.length} registros insertados en "${coleccion}" con tipos normalizados.`);
      } catch (err) {
        res.status(500).send('❌ Error al insertar en MongoDB: ' + err.message);
      }
    })
    .on('error', (err) => {
      res.status(500).send('❌ Error al procesar el CSV: ' + err.message);
    });
});

app.post('/login', async (req, res) => {
  const { rfc } = req.body;

  if (!rfc) {
    return res.status(400).json({ error: 'RFC requerido' });
  }

  try {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    const db = client.db(dbName);

    const empleado = await db.collection(colEmpleados).findOne({ RFC: rfc.toUpperCase() });

    if (!empleado) {
      return res.status(401).json({ error: 'RFC no encontrado' });
    }

    // Generar JWT
    const token = jwt.sign(
      {
        EMPLEADO: empleado.EMPLEADO,
        RFC: empleado.RFC,
        NOMBRE: empleado.NOMBRE
      },
      SECRET_KEY,
      { expiresIn: '4h' }
    );

    res.json({
      token,
      empleado: {
        EMPLEADO: empleado.EMPLEADO,
        NOMBRE: empleado.NOMBRE,
        APPAT: empleado.APPAT,
        APMAT: empleado.APMAT,
        RFC: empleado.RFC,
        CURP: empleado.CURP
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
});


// Devolver solo el JSON del reporte sin generar PDF
app.get("/json/:empleado/:periodo", async (req, res) => {
  const empleado = parseInt(req.params.empleado);
  const periodo = parseInt(req.params.periodo);

  if (isNaN(empleado) || isNaN(periodo)) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  try {
    const data = await getDatosNomina(empleado, periodo);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Nuevo endpoint para obtener resumen de recibos por empleado
app.get("/recibos/:empleado", async (req, res) => {
  const empleado = parseInt(req.params.empleado);

  if (isNaN(empleado)) {
    return res.status(400).json({ error: "Empleado inválido" });
  }

  try {
    const client = await MongoClient.connect(mongoUrl);
    const db = client.db(dbName);

    // Obtener todos los conceptos del empleado
    const conceptosRaw = await db
      .collection(colConceptos)
      .find({ EMPLEADO: empleado })
      .toArray();

    // Agrupar por PERIODO
    const agrupados = {};
    for (const c of conceptosRaw) {
      const periodo = c.PERIODO;
      if (!agrupados[periodo]) {
        agrupados[periodo] = {
          periodo,
          empleado: c.EMPLEADO,
          fechaPago: `${formatearFechaTexto(c.FECHDES)} al ${formatearFechaTexto(c.FECHHAS)}`,
          percepciones: 0,
          prestaciones: 0,
          deducciones: 0,
        };
      }

      if (c.PERCDESC >= 1 && c.PERCDESC < 13) {
        agrupados[periodo].percepciones += c.IMPORTE;
      } else if (c.PERCDESC >= 13 && c.PERCDESC < 500) {
        agrupados[periodo].prestaciones += c.IMPORTE;
      } else if (c.PERCDESC >= 500) {
        agrupados[periodo].deducciones += c.IMPORTE;
      }
    }

    const resumen = Object.values(agrupados).map(r => ({
      ...r,
      percepciones: r.percepciones.toFixed(2),
      deducciones: r.deducciones.toFixed(2),
      neto: (r.percepciones + r.prestaciones - r.deducciones).toFixed(2)
    })).sort((a, b) => a.periodo - b.periodo); // orden ascendente

    res.json(resumen);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener recibos" });
  }
});

app.get("/hola", async (req, res) => {

  res.json({
    message: "Hola, mundo!"
  });
}
);



async function getDatosNomina(empleado, periodo) {
  const client = await MongoClient.connect(mongoUrl);
  const db = client.db(dbName);

  // Si el periodo es 0, no filtramos por PERIODO
  const filtroPeriodo = periodo === 0 ? {} : { PERIODO: periodo };
  const conceptosRaw = await db.collection(colConceptos).find({ EMPLEADO: empleado, ...filtroPeriodo }).toArray();
  const empleadoData = await db.collection(colEmpleados).findOne({ EMPLEADO: empleado });

  const percepciones = conceptosRaw.filter(c => c.PERCDESC >= 1 && c.PERCDESC < 13);
  const prestaciones = conceptosRaw.filter(c => c.PERCDESC >= 13 && c.PERCDESC < 500);
  const deducciones = conceptosRaw.filter(c => c.PERCDESC >= 500);

  const totalPercepciones = percepciones.reduce((s, c) => s + c.IMPORTE, 0);
  const totalPrestaciones = prestaciones.reduce((s, c) => s + c.IMPORTE, 0);
  const totalDeducciones = deducciones.reduce((s, c) => s + c.IMPORTE, 0);

  const conceptos = conceptosRaw.map(c => ({
    ...c,
    percepcion: (c.PERCDESC >= 1 && c.PERCDESC < 13) ? `${c.IMPORTE.toFixed(2)}` : "",
    prestacion: (c.PERCDESC >= 13 && c.PERCDESC < 500) ? `${c.IMPORTE.toFixed(2)}` : "",
    deduccion: (c.PERCDESC >= 500) ? `${c.IMPORTE.toFixed(2)}` : ""
  }));

  return {
    empleado: empleadoData,
    periodo,
    fechaPago: `${formatearFechaTexto(conceptosRaw[0]?.FECHDES)} al ${formatearFechaTexto(conceptosRaw[0]?.FECHHAS)}`,
    conceptos,
    totales: {
      percepciones: totalPercepciones.toFixed(2),
      prestaciones: totalPrestaciones.toFixed(2),
      deducciones: totalDeducciones.toFixed(2),
      neto: (totalPercepciones + totalPrestaciones - totalDeducciones).toFixed(2)
    },
    cantidadLetras: numeroALetras(totalPercepciones + totalPrestaciones - totalDeducciones),
  };
}

async function init() {
  await jsreport.init();

  app.get("/reporte/:empleado/:periodo", async (req, res) => {
    const empleado = parseInt(req.params.empleado);
    const periodo = parseInt(req.params.periodo);
  
    if (isNaN(empleado) || isNaN(periodo)) {
      return res.status(400).json({ error: "Parámetros inválidos" });
    }
  
    try {
      const data = await getDatosNomina(empleado, periodo);
      const templateHtml = fs.readFileSync(path.join(__dirname, "templates", "nomina.html")).toString();
  
      const result = await jsreport.render({
        template: {
          content: templateHtml,
          engine: "handlebars",
          recipe: "chrome-pdf",
        },
        data
      });
  
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename=recibo_${empleado}_${periodo}.pdf`);
      result.stream.pipe(res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(3001, () => {
    console.log("✅ Servidor activo en http://localhost:3001");
  });
}



init();