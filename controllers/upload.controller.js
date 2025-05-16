

const fs = require('fs');
const csv = require('csv-parser');
const { getDb } = require('../helpers/mongo.helper');
const  camposNumericos  = require('../helpers/tablas-conversion-camposnumericos');

exports.subirCSV = (req, res) => {
  const coleccion = req.params.coleccion;
  const archivoCSV = req.file;

  if (!archivoCSV) {
    return res.status(400).send('❌ No se envió archivo');
  }

  const registros = [];
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
       // si la coleccion es diferente a mnom12 o mnom12h, no se elminan los registros
        if (coleccion !== 'mnom12' && coleccion !== 'mnom12h' && coleccion !== 'mno01' && coleccion !== 'mnom01h') {
          await db.collection(coleccion).deleteMany({});
        }
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