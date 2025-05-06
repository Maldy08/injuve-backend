function formatearFechaTexto(fechaStr) {
  if (!fechaStr) return '';
  const partes = fechaStr.split(' ')[0]; // "19/4/2025"
  const [dia, mes, anio] = partes.split('/');
  return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${anio}`;
}
  module.exports = formatearFechaTexto;