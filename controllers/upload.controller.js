const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { getDb } = require('../helpers/mongo.helper');
const camposNumericos = require('../helpers/tablas-conversion-camposnumericos');

const BACKUP_DIR = path.join(__dirname, '../backups-nomina');

exports.subirCSV = (req, res) => {
  const coleccion = req.params.coleccion;
  const archivoCSV = req.file;

  if (!archivoCSV) {
    return res.status(400).send('❌ No se envió archivo');
  }

  const registros = [];
  const campos = camposNumericos[coleccion] || [];

  fs.createReadStream(archivoCSV.path, { encoding: 'utf8' })
    .pipe(csv({ separator: ',' }))
    .on('data', (row) => {
      const claves = Object.keys(row);
      const primeraClave = claves[0];

      if (primeraClave.startsWith('\uFEFF')) {
        const nuevaClave = primeraClave.replace('\uFEFF', '').replace(/"/g, '');
        row[nuevaClave] = row[primeraClave];
        delete row[primeraClave];
      }

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

        if (['mnom12', 'mnom12h'].includes(coleccion)) {
          const periodo = registros[0]?.PERIODO;
          if (periodo !== undefined && periodo !== null && periodo !== '') {
            await db.collection(coleccion).deleteMany({ PERIODO: periodo });
          }
        } else {
          await db.collection(coleccion).deleteMany({});
        }

        await db.collection(coleccion).insertMany(registros);

        if (coleccion === 'mnom01' || coleccion === 'mnom01h') {
          const rfcs = [...new Set(registros.map(r => r.RFC).filter(Boolean))];
          for (const rfc of rfcs) {
            const existe = await db.collection('accesos').findOne({ RFC: rfc });
            if (!existe) {
              await db.collection('accesos').insertOne({
                RFC: rfc,
                TIPO: coleccion === 'mnom01' ? 1 : 2,
                ADMIN: 0
              });
            }
          }
        }

        fs.unlinkSync(archivoCSV.path);
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

exports.subirMDB = (req, res) => {
  const archivo = req.file;

  if (!archivo) {
    return res.status(400).json({ mensaje: '❌ No se envió archivo' });
  }

  const ext = path.extname(archivo.originalname).toLowerCase();
  if (ext !== '.mdb') {
    fs.unlinkSync(archivo.path);
    return res.status(400).json({ mensaje: '❌ Solo se permiten archivos .mdb' });
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const archivosExistentes = fs.readdirSync(BACKUP_DIR);
  const regex = /^NOMINAPER(\d+)\.MDB$/i;
  let maxNum = 0;
  archivosExistentes.forEach((nombre) => {
    const match = nombre.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });

  const nuevoNombre = `NOMINAPER${maxNum + 1}.MDB`;
  const destino = path.join(BACKUP_DIR, nuevoNombre);

  try {
    fs.copyFileSync(archivo.path, destino);
    fs.unlinkSync(archivo.path);
    res.json({ mensaje: `✅ Respaldo guardado como "${nuevoNombre}"`, archivo: nuevoNombre });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: '❌ Error al guardar el respaldo: ' + err.message });
  }
};