const XLSX = require('xlsx');
const { getDb } = require('../helpers/mongo.helper');

exports.generarExcel = async (req, res) => {
  const db = getDb();
  const { periodo, tipo } = req.query;
  if (!periodo || !tipo) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  const data = [
    { nombre: 'Juan', edad: 30 },
    { nombre: 'Ana', edad: 25 }
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Personas');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Enviar como archivo descargable
  res.setHeader('Content-Disposition', 'attachment; filename=reporte.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
};