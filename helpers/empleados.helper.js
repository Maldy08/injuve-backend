exports.calcularAniosTrabajados = (fechaAltaStr) => {
    const [dia, mes, anio] = fechaAltaStr.split('/');
    const fechaAlta = new Date(`${anio}-${mes}-${dia}`);
    const hoy = new Date(2025, 12, 31);
    const diffMs = hoy - fechaAlta;
    const anios = diffMs / (1000 * 60 * 60 * 24 * 365.25);
    return Math.floor(anios);
}


exports.obtenerDiasVacaciones = (anios) => {
    const vacaciones = {
        1: 11,
        2: 12,
        3: 13,
        4: 14,
        5: 15,
        6: 16,
        7: 16,
        8: 16,
        9: 16,
        10: 16,
        11: 18,
        12: 18,
        13: 18,
        14: 18,
        15: 18,
        16: 20,
        17: 20,
        18: 20,
        19: 20,
        20: 20,
        21: 22,
        22: 22,
        23: 22,
        24: 22,
        25: 22,
        26: 24,
        27: 24,
        28: 24,
        29: 24,
        30: 24,
        31: 26,
        32: 26,
        33: 26,
        34: 26,
        35: 26,
        36: 28,
        37: 28,
        38: 28,
        39: 28,
        40: 28,
    }

    if (vacaciones[anios]) return vacaciones[anios];
    // Si el año es mayor que el máximo, toma el máximo
    const maxAnios = Math.max(...Object.keys(vacaciones).map(Number));
    if (anios > maxAnios) return vacaciones[maxAnios];
    // Si el año es menor que el mínimo, toma el mínimo
    const minAnios = Math.min(...Object.keys(vacaciones).map(Number));
    if (anios < minAnios) return vacaciones[minAnios];
    // Si no hay coincidencia exacta, busca el mayor menor o igual
    for (let i = anios; i >= minAnios; i--) {
        if (vacaciones[i]) return vacaciones[i];
    }
    return 0;
}