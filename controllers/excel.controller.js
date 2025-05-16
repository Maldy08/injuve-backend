const XLSX = require('xlsx');
const { getDb } = require('../helpers/mongo.helper');

exports.generarExcel = async (req, res) => {
  const db = getDb();
  const { periodo, tipo } = req.query;
  if (!periodo || !tipo) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  const collectionName = tipo == 1 ? 'mnom12' : 'mnom12h';

  const data = await db.collection(collectionName).find({ PERIODO: Number(periodo) }).toArray();

  const headers = [
    { header: 'RFC', key: 'RFC', width: 15 },
    { header: 'CURP', key: 'CURP', width: 15 },
    { header: 'TipoNonina', key: 'TipoNonina', width: 15 },
    { header: 'FechaPago', key: 'FechaPago', width: 15 },
    { header: 'FechaInicialPago', key: 'FechaInicialPago', width: 15 },
    { header: 'FechaFinalPago', key: 'FechaFinalPago', width: 15 },

    // Agrega más encabezados según sea necesario
  ]

  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A1" });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nomina');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Enviar como archivo descargable
  res.setHeader('Content-Disposition', 'attachment; filename=reporte.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
};