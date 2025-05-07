

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { getDb } = require('../helpers/mongo.helper');

exports.subirCSV = (req, res) => {
  const coleccion = req.params.coleccion;
  const archivoCSV = req.file;

  if (!archivoCSV) {
    return res.status(400).send('❌ No se envió archivo');
  }

  const registros = [];

  // Mapeo de campos numéricos por colección
  const camposNumericos = {
    mnom12: ['EMPLEADO', 'PERIODO', 'PERCDESC', 'IMPORTE', 'TIPONOM', 'RECIBO', 'DIASTRA', 'NIVEL', 'CLUES'],
    mnom01: ['EMPLEADO', 'DEPTO', 'CAT', 'PROGRAMA', 'SUBPROGRAMA', 'META', 'ACCION', 'MPIO', 'NIVEL', 'PUESTO', 'SUELDO']
  };

  const campos = camposNumericos[coleccion] || [];

  fs.createReadStream(archivoCSV.path)
    .pipe(csv({ separator: ',' }))
    .on('data', (row) => {
      campos.forEach((campo) => {
        if (row[campo]) {
          const limpio = row[campo].replace(/[$,%]/g, '').replace(/,/g, '').trim();
          const num = Number(limpio);
          if (!isNaN(num)) row[campo] = num;
        }
      });

      registros.push(row);
    })
    .on('end', async () => {
      try {
        const db = getDb();
        await db.collection(coleccion).deleteMany({}); // Opcional: limpia antes de insertar
        await db.collection(coleccion).insertMany(registros);

        fs.unlinkSync(archivoCSV.path); // Limpia archivo temporal

        res.send(`✅ ${registros.length} registros insertados en "${coleccion}"`);
      } catch (err) {
        console.error(err);
        res.status(500).send('❌ Error al insertar en MongoDB: ' + err.message);
      }
    })
    .on('error', (err) => {
      res.status(500).send('❌ Error al procesar el CSV: ' + err.message);
    });
};