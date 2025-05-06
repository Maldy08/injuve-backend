function numeroALetras(num) {
  function unidades(n) {
    return [
      '', 'Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis',
      'Siete', 'Ocho', 'Nueve'
    ][n];
  }

  function decenas(n) {
    const especiales = [
      '', 'Diez', 'Once', 'Doce', 'Trece', 'Catorce', 'Quince',
      'Dieciséis', 'Diecisiete', 'Dieciocho', 'Diecinueve'
    ];
    const dec = [
      '', '', 'Veinte', 'Treinta', 'Cuarenta', 'Cincuenta',
      'Sesenta', 'Setenta', 'Ochenta', 'Noventa'
    ];
    if (n < 10) return unidades(n);
    if (n < 20) return especiales[n - 9];
    const u = n % 10;
    const d = Math.floor(n / 10);
    return dec[d] + (u ? ' y ' + unidades(u) : '');
  }

  function centenas(n) {
    const cent = [
      '', 'Ciento', 'Doscientos', 'Trescientos', 'Cuatrocientos',
      'Quinientos', 'Seiscientos', 'Setecientos', 'Ochocientos', 'Novecientos'
    ];
    if (n === 100) return 'Cien';
    const c = Math.floor(n / 100);
    const resto = n % 100;
    return cent[c] + (resto ? ' ' + decenas(resto) : '');
  }

  function miles(n) {
    if (n < 1000) return centenas(n);
    const mil = Math.floor(n / 1000);
    const resto = n % 1000;
    const milTexto = mil === 1 ? 'Mil' : `${centenas(mil)} Mil`;
    return milTexto + (resto ? ' ' + centenas(resto) : '');
  }

  function millones(n) {
    if (n < 1000000) return miles(n);
    const millon = Math.floor(n / 1000000);
    const resto = n % 1000000;
    const millonTexto = millon === 1 ? 'Un Millón' : `${miles(millon)} Millones`;
    return millonTexto + (resto ? ' ' + miles(resto) : '');
  }

  const entero = Math.floor(num);
  const decimales = Math.round((num - entero) * 100);

  const letras = millones(entero);
  const centavos = decimales.toString().padStart(2, '0');

  return `Son ${letras} Pesos ${centavos}/100 M.N.`;
}

module.exports = numeroALetras;