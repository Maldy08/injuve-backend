
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

  fs.createReadStream(archivoCSV.path)
    .pipe(csv({ separator: ',' }))
    .on('data', (row) => {
      // Normalizar campos numéricos
      const camposNumericos = ['EMPLEADO', 'PERIODO', 'PERCDESC', 'IMPORTE', 'TIPONOM', 'RECIBO', 'DIASTRA', 'NIVEL', 'CLUES'];
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
        const db = getDb();
        await db.collection(coleccion).insertMany(registros);

        fs.unlinkSync(archivoCSV.path); // Eliminar archivo temporal

        res.send(`✅ ${registros.length} registros insertados en "${coleccion}"`);
      } catch (err) {
        res.status(500).send('❌ Error al insertar en MongoDB: ' + err.message);
      }
    })
    .on('error', (err) => {
      res.status(500).send('❌ Error al procesar el CSV: ' + err.message);
    });
};
