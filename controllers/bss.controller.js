const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const { create } = require('xmlbuilder2');
const { getDb } = require('../helpers/mongo.helper');
const { initJsReport } = require('../helpers/jsreport.helper');

const fmtMxn = (n) => Number(n || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

exports.uploadExcelBss = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    let workbook;
    try {
        workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } catch (e) {
        return res.status(400).json({ error: 'El archivo no es un Excel válido.' });
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        return res.status(400).json({ error: 'El Excel no contiene hojas.' });
    }

    // raw:true para que los números lleguen como Number nativos. Con raw:false
    // los importes vienen formateados como " 3,026.83 " (formato contable) y
    // Number(" 3,026.83 ") = NaN, que era el motivo por el que se tenía que
    // "trabajar" el archivo manualmente antes de subirlo.
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: true, defval: null });

    const pickKey = (row, candidates) => {
        const keys = Object.keys(row);
        for (const cand of candidates) {
            const found = keys.find(k => k.trim().toUpperCase() === cand);
            if (found) return found;
        }
        return null;
    };

    // Parser tolerante: acepta número nativo o string con formato contable,
    // signos $, paréntesis (negativos) y guiones largos/cortos como 0.
    const parseImporte = (value) => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        const s = String(value).trim();
        if (!s) return null;
        if (s === '-' || s === '—' || s === '–') return 0;
        const negativo = /^\(.*\)$/.test(s);
        const cleaned = s.replace(/[,$\s()]/g, '');
        const n = Number(cleaned);
        if (!Number.isFinite(n)) return null;
        return negativo ? -n : n;
    };

    const db = getDb();
    const bssCollection = db.collection('bss');

    let actualizados = 0;
    let noEncontrados = 0;
    let omitidos = 0;
    const noEncontradosList = [];

    for (const row of rows) {
        const empKey = pickKey(row, ['EMPLEADO']);
        const bssKey = pickKey(row, ['BSS', 'BSS DEVENGADO', 'IMPORTE BSS']);
        if (!empKey || !bssKey) { omitidos++; continue; }

        const empRaw = row[empKey];
        if (empRaw === null || empRaw === undefined || empRaw === '') { omitidos++; continue; }
        const empleadoStr = String(empRaw).trim().padStart(3, '0');

        const importe = parseImporte(row[bssKey]);
        if (importe === null) { omitidos++; continue; }

        const result = await bssCollection.updateOne(
            { empleado: empleadoStr },
            { $set: { importe_new: importe } }
        );
        if (result.matchedCount === 0) {
            noEncontrados++;
            noEncontradosList.push(empleadoStr);
        } else {
            actualizados++;
        }
    }

    // Snapshot de totales por banco para revisión rápida. Se agrupa según la
    // misma regla que usan los exports: banco "012" -> BBVA, cualquier otro
    // -> OTROS. Se suman solo importes > 0 (los que efectivamente se pagarían).
    const agregados = await bssCollection.aggregate([
        { $match: { importe_new: { $gt: 0 } } },
        {
            $group: {
                _id: { $cond: [{ $eq: ['$banco', '012'] }, 'BBVA', 'OTROS'] },
                total: { $sum: '$importe_new' },
                empleados: { $sum: 1 },
            }
        }
    ]).toArray();

    const totalesPorBanco = { BBVA: { total: 0, empleados: 0 }, OTROS: { total: 0, empleados: 0 } };
    for (const t of agregados) {
        totalesPorBanco[t._id] = {
            total: Math.round(t.total * 100) / 100,
            empleados: t.empleados,
        };
    }

    const totalesCollection = db.collection('bss_totales');
    const ahora = new Date();
    for (const banco of ['BBVA', 'OTROS']) {
        await totalesCollection.updateOne(
            { banco },
            { $set: { ...totalesPorBanco[banco], actualizadoEn: ahora } },
            { upsert: true }
        );
    }

    res.json({
        message: 'Importe BSS actualizado correctamente.',
        total: rows.length,
        actualizados,
        noEncontrados,
        omitidos,
        empleadosNoEncontrados: noEncontradosList,
        totalesPorBanco,
    });
};


exports.exportarBssXml = async (req, res) => {
    const { periodo, banco } = req.params;

    if (!banco || !periodo) {
        return res.status(400).json({ error: 'Los parámetros banco y periodo son requeridos.' });
    }
    const filtado = banco === 'PENSION' ? 'PENSION' : banco !== "012" ? 'OTROS' : 'BBVA';
    const db = getDb();


    let query = {};
    if (filtado === 'BBVA') {
        query = { banco: "012" };
    } else if (filtado === 'OTROS') {
        query = { banco: { $ne: "012" } };
    } else {
        query = { pensionAlimenticia: { $exists: true } };
    }
    const bssCollection = await db.collection('bss').find(query)
        .sort({ empleado: 1 })
        .toArray();

    //const fechaPago = await db.collection('mnom12').findOne({ PERIODO: Number(periodo) });
    let nuevaFechaPago = new Date();
    const dia = String(nuevaFechaPago.getDate()).padStart(2, '0');
    const mes = String(nuevaFechaPago.getMonth() + 1).padStart(2, '0');
    const anio = nuevaFechaPago.getFullYear();
    nuevaFechaPago = `${dia}/${mes}/${anio}`;

    if (filtado !== 'BBVA') {
        const diasExtra = filtado === 'PENSION' ? 2 : 1;
        if (typeof nuevaFechaPago === 'string' && nuevaFechaPago.includes('/')) {
            const [dia, mes, anio] = nuevaFechaPago.split('/');
            // Usa el constructor Date correcto (mes base 0)
            const fechaObj = new Date(Number(anio), Number(mes) - 1, Number(dia));
            fechaObj.setDate(fechaObj.getDate() + diasExtra);
            const diaF = String(fechaObj.getDate()).padStart(2, '0');
            const mesF = String(fechaObj.getMonth() + 1).padStart(2, '0');
            const anioF = fechaObj.getFullYear();
            nuevaFechaPago = `${diaF}/${mesF}/${anioF}`;
        } else {
            // Si viene en otro formato compatible con Date
            const fechaObj = new Date(nuevaFechaPago);
            fechaObj.setDate(fechaObj.getDate() + diasExtra);
            const diaF = String(fechaObj.getDate()).padStart(2, '0');
            const mesF = String(fechaObj.getMonth() + 1).padStart(2, '0');
            const anioF = fechaObj.getFullYear();
            nuevaFechaPago = `${diaF}/${mesF}/${anioF}`;
        }
    }


    const root = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('nomina', {
            version: '1.0',
            claveOrganismo: '10111',
            descripcion: 'INJUVE',
            periodo: `PERIODO DE PAGO ${periodo}`,
            tipoNomina: '160',
            ejercicio: String(new Date().getFullYear()),
            fechaPago: nuevaFechaPago,
            fechaInicialPago: nuevaFechaPago,
            fechaFinalPago: nuevaFechaPago
        });

    bssCollection.forEach(item => {
        if (item.importe_new === 0) return;

        if (filtado === 'PENSION') {
            if (!item.pensionAlimenticia) return;
            const importePension = Number((item.importe_new * item.pensionAlimenticia.porcentaje / 100).toFixed(2));
            const benef = item.pensionAlimenticia.beneficiaria;
            const pago = root.ele('pago', {
                numEmpleado: (item.empleado || '') + 'PA',
                nombreCompleto: benef.nombre || '',
                curp: benef.curp || '',
                tipoRegimen: item.tiporegimen || '',
                numSeguridadSocial: '',
                numDiasPagados: '14',
                departamento: '',
                clabe: benef.clabe || '',
                banco: benef.banco || '',
                periodicidadPago: '14'
            });
            const percepciones = pago.ele('percepciones', {
                totalGravado: '0.00',
                totalExcento: importePension.toFixed(2)
            });
            percepciones.ele('percepcion', {
                tipoPercepcion: '100',
                concepto: 'PENSION ALIMENTICIA BONO DE SEGURIDAD SOCIAL',
                importeGravado: '0.00',
                importeExcento: importePension.toFixed(2),
            });
        } else {
            let importeEmpleado = item.importe_new;
            if (item.pensionAlimenticia) {
                const importePension = Number((item.importe_new * item.pensionAlimenticia.porcentaje / 100).toFixed(2));
                importeEmpleado = Number((item.importe_new - importePension).toFixed(2));
            }
            const pago = root.ele('pago', {
                numEmpleado: item.empleado || '',
                nombreCompleto: item.nombre || '',
                curp: item.curp || '',
                tipoRegimen: item.tiporegimen || '',
                numSeguridadSocial: item.isstecali || '',
                numDiasPagados: '14',
                departamento: '',
                clabe: item.clabe || '',
                banco: item.banco || '',
                periodicidadPago: item.periodicidadPago || '14'
            });
            const percepciones = pago.ele('percepciones', {
                totalGravado: item.totalGravado || '0.00',
                totalExcento: item.totalExcento || importeEmpleado.toFixed(2)
            });
            percepciones.ele('percepcion', {
                tipoPercepcion: item.tipoPercepcion || '100',
                concepto: item.concepto || 'BONO DE SEGURIDAD SOCIAL',
                importeGravado: '0.00',
                importeExcento: importeEmpleado.toFixed(2),
            });
        }
    });

    let xml = root.end({ prettyPrint: false });
    xml = xml.replace('?>', '?>\n');
    const filename = `BSS_${periodo}_${filtado}.xml`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(xml);

}

exports.exportarBssTxt = async (req, res) => {
    const { periodo, banco } = req.params;
    if (!banco) {
        return res.status(400).json({ error: 'El parámetro banco es requerido.' });
    }
    const filtado = banco === 'PENSION' ? 'PENSION' : banco !== "012" ? 'OTROS' : 'BBVA';
    const db = getDb();


    let query = {};
    if (filtado === 'BBVA') {
        query = { banco: "012" };
    } else if (filtado === 'OTROS') {
        query = { banco: { $ne: "012" } };
    } else {
        query = { pensionAlimenticia: { $exists: true } };
    }
    const bssCollection = await db.collection('bss').find(query).toArray();

    function fixed(str, length, pad = ' ', dir = 'right') {
        str = str === undefined || str === null ? '' : String(str);
        if (str.length > length) return str.substring(0, length);
        if (dir === 'left') return str.padStart(length, pad);
        return str.padEnd(length, pad);
    }

    let consecutivo = 1;
    const lines = bssCollection.map(item => {
        if (item.importe_new === 0) return '';
        if (filtado === 'PENSION') {
            if (!item.pensionAlimenticia) return '';
            const importePension = Number((item.importe_new * item.pensionAlimenticia.porcentaje / 100).toFixed(2));
            const benef = item.pensionAlimenticia.beneficiaria;
            return (
                fixed(consecutivo++, 9, '0', 'left') +
                fixed(benef.rfc, 16) +
                fixed('99') +
                fixed(benef.clabe, 20) +
                fixed(String(importePension.toFixed(2)).replace('.', ''), 15, '0', 'left') +
                fixed(benef.nombre, 40) +
                fixed(benef.banco, 3, '0', 'left') +
                fixed('001', 3, '0', 'left')
            );
        }
        let importeEmpleado = item.importe_new;
        if (item.pensionAlimenticia) {
            const importePension = Number((item.importe_new * item.pensionAlimenticia.porcentaje / 100).toFixed(2));
            importeEmpleado = Number((item.importe_new - importePension).toFixed(2));
        }
        return (
            fixed(consecutivo++, 9, '0', 'left') +                          // 1.- Numero consecutivo del registro (9)
            fixed(item.rfc, 16) +                                           // 2.- RFC del empleado (16)
            fixed(filtado === 'BBVA' ? '99' : '40') +                        // 3.- Tipo de cuenta (2)
            fixed(item.clabe, 20, ' ', 'rigth') +                     // 4.- Numero de cuenta (20)
            fixed(
                String(importeEmpleado.toFixed(2)).replace('.', ''),
                15, '0', 'left'
            ) +                                                           // 5.- Importe a pagar (15, sin decimales)
            fixed(item.nombre, 40) +                                        // 6.- Nombre trabajador (40)
            fixed(item.banco, 3, '0', 'left') +                      // 7.- Banco destino (3)
            fixed('001', 3, '0', 'left')                        // 8.- Plaza destino (3)
        );
    });

    const txt = lines.join('\n');
    const filename = `BSS_${periodo}_${filtado}.txt`;
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(txt);
};

exports.getDatosBSS = async (req, res) => {

    const db = getDb();
    const bssCollection = await db.collection('bss').find({})
        .sort({ empleado: 1 })
        .toArray();


    return res.json(bssCollection);

}


// ...otros requires...

exports.exportarBssZip = async (req, res) => {
    const { periodo, banco } = req.params;
    if (!banco || !periodo) {
        return res.status(400).json({ error: 'Los parámetros banco y periodo son requeridos.' });
    }
    const filtado = banco === 'PENSION' ? 'PENSION' : banco !== "012" ? 'OTROS' : 'BBVA';
    const db = getDb();

    // --- Genera el XML (igual que en exportarBssXml) ---
    let query = {};
    if (filtado === 'BBVA') {
        query = { banco: "012" };
    } else if (filtado === 'OTROS') {
        query = { banco: { $ne: "012" } };
    } else {
        query = { pensionAlimenticia: { $exists: true } };
    }
    const bssCollection = await db.collection('bss').find(query).sort({ empleado: 1 }).toArray();

    // ...lógica de fecha...
    let nuevaFechaPago = new Date();
    const dia = String(nuevaFechaPago.getDate()).padStart(2, '0');
    const mes = String(nuevaFechaPago.getMonth() + 1).padStart(2, '0');
    const anio = nuevaFechaPago.getFullYear();
    nuevaFechaPago = `${dia}/${mes}/${anio}`;
    if (filtado !== 'BBVA') {
        const diasExtra = filtado === 'PENSION' ? 2 : 1;
        if (typeof nuevaFechaPago === 'string' && nuevaFechaPago.includes('/')) {
            const [dia, mes, anio] = nuevaFechaPago.split('/');
            const fechaObj = new Date(Number(anio), Number(mes) - 1, Number(dia));
            fechaObj.setDate(fechaObj.getDate() + diasExtra);
            const diaF = String(fechaObj.getDate()).padStart(2, '0');
            const mesF = String(fechaObj.getMonth() + 1).padStart(2, '0');
            const anioF = fechaObj.getFullYear();
            nuevaFechaPago = `${diaF}/${mesF}/${anioF}`;
        } else {
            const fechaObj = new Date(nuevaFechaPago);
            fechaObj.setDate(fechaObj.getDate() + diasExtra);
            const diaF = String(fechaObj.getDate()).padStart(2, '0');
            const mesF = String(fechaObj.getMonth() + 1).padStart(2, '0');
            const anioF = fechaObj.getFullYear();
            nuevaFechaPago = `${diaF}/${mesF}/${anioF}`;
        }
    }

    const { create } = require('xmlbuilder2');
    const root = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('nomina', {
            version: '1.0',
            claveOrganismo: '10111',
            descripcion: 'INJUVE',
            periodo: `PERIODO DE PAGO ${periodo}`,
            tipoNomina: '160',
            ejercicio: String(new Date().getFullYear()),
            fechaPago: nuevaFechaPago,
            fechaInicialPago: nuevaFechaPago,
            fechaFinalPago: nuevaFechaPago
        });

    bssCollection.forEach(item => {
        if (item.importe_new === 0) return;

        if (filtado === 'PENSION') {
            if (!item.pensionAlimenticia) return;
            const importePension = Number((item.importe_new * item.pensionAlimenticia.porcentaje / 100).toFixed(2));
            const benef = item.pensionAlimenticia.beneficiaria;
            const pago = root.ele('pago', {
                numEmpleado: (item.empleado || '') + 'PA',
                nombreCompleto: benef.nombre || '',
                curp: benef.curp || '',
                tipoRegimen: item.tiporegimen || '',
                numSeguridadSocial: '',
                numDiasPagados: '14',
                departamento: '',
                clabe: benef.clabe || '',
                banco: benef.banco || '',
                periodicidadPago: '14'
            });
            const percepciones = pago.ele('percepciones', {
                totalGravado: '0.00',
                totalExcento: importePension.toFixed(2)
            });
            percepciones.ele('percepcion', {
                tipoPercepcion: '100',
                concepto: 'PENSION ALIMENTICIA BONO DE SEGURIDAD SOCIAL',
                importeGravado: '0.00',
                importeExcento: importePension.toFixed(2),
            });
        } else {
            let importeEmpleado = item.importe_new;
            if (item.pensionAlimenticia) {
                const importePension = Number((item.importe_new * item.pensionAlimenticia.porcentaje / 100).toFixed(2));
                importeEmpleado = Number((item.importe_new - importePension).toFixed(2));
            }
            const pago = root.ele('pago', {
                numEmpleado: item.empleado || '',
                nombreCompleto: item.nombre || '',
                curp: item.curp || '',
                tipoRegimen: item.tiporegimen || '',
                numSeguridadSocial: item.isstecali || '',
                numDiasPagados: '14',
                departamento: '',
                clabe: item.clabe || '',
                banco: item.banco || '',
                periodicidadPago: item.periodicidadPago || '14'
            });
            const percepciones = pago.ele('percepciones', {
                totalGravado: item.totalGravado || '0.00',
                totalExcento: item.totalExcento || importeEmpleado.toFixed(2)
            });
            percepciones.ele('percepcion', {
                tipoPercepcion: item.tipoPercepcion || '100',
                concepto: item.concepto || 'BONO DE SEGURIDAD SOCIAL',
                importeGravado: '0.00',
                importeExcento: importeEmpleado.toFixed(2),
            });
        }
    });

    let xml = root.end({ prettyPrint: false });
    xml = xml.replace('?>', '?>\n');
    const xmlFilename = `BSS_${periodo}_${filtado}.xml`;

    // --- Genera el TXT (igual que en exportarBssTxt) ---
    function fixed(str, length, pad = ' ', dir = 'right') {
        str = str === undefined || str === null ? '' : String(str);
        if (str.length > length) return str.substring(0, length);
        if (dir === 'left') return str.padStart(length, pad);
        return str.padEnd(length, pad);
    }
    let consecutivo = 1;
    const lines = bssCollection.map(item => {
        if (item.importe_new === 0) return '';
        if (filtado === 'PENSION') {
            if (!item.pensionAlimenticia) return '';
            const importePension = Number((item.importe_new * item.pensionAlimenticia.porcentaje / 100).toFixed(2));
            const benef = item.pensionAlimenticia.beneficiaria;
            return (
                fixed(consecutivo++, 9, '0', 'left') +
                fixed(benef.rfc, 16) +
                fixed('99') +
                fixed(benef.clabe, 20) +
                fixed(String(importePension.toFixed(2)).replace('.', ''), 15, '0', 'left') +
                fixed(benef.nombre, 40) +
                fixed(benef.banco, 3, '0', 'left') +
                fixed('001', 3, '0', 'left')
            );
        }
        let importeEmpleado = item.importe_new;
        if (item.pensionAlimenticia) {
            const importePension = Number((item.importe_new * item.pensionAlimenticia.porcentaje / 100).toFixed(2));
            importeEmpleado = Number((item.importe_new - importePension).toFixed(2));
        }
        return (
            fixed(consecutivo++, 9, '0', 'left') +
            fixed(item.rfc, 16) +
            fixed(filtado === 'BBVA' ? '99' : '40') +
            fixed(item.clabe, 20, ' ', 'right') +
            fixed(
                String(importeEmpleado.toFixed(2)).replace('.', ''),
                15, '0', 'left'
            ) +
            fixed(item.nombre, 40) +
            fixed(item.banco, 3, '0', 'left') +
            fixed('001', 3, '0', 'left')
        );
    });
    const txt = lines.join('\n');
    const txtFilename = `BSS_${periodo}_${filtado}.txt`;

    // --- Crea el ZIP y lo envía ---
    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=BSS_${periodo}_${filtado}.zip`);
    archive.pipe(res);

    archive.append(xml, { name: xmlFilename });
    archive.append(txt, { name: txtFilename });

    archive.finalize();
};

exports.actualizarBss = async (req, res) => {
    const db = getDb();
    const bssData = req.body;

    if (!bssData || !bssData.empleado) {
        return res.status(400).json({ error: 'El objeto bss debe incluir el campo "empleado".' });
    }

    // Elimina _id si existe
    if (bssData._id) {
        delete bssData._id;
    }

    try {
        const result = await db.collection('bss').updateOne(
            { empleado: String(bssData.empleado) },
            { $set: bssData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Empleado no encontrado.' });
        }

        res.json({ message: 'Registro BSS actualizado correctamente.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar el registro BSS.' });
    }
};

// GET /api/backend/bss/reporte-pdf/:periodo
// PDF de revisión con el estado actual de la colección bss, agrupado por banco
// (BBVA = "012" / OTROS = resto). Solo entran empleados con importe_new > 0.
exports.reporteBssPdf = async (req, res) => {
    const { periodo } = req.params;
    if (!periodo) {
        return res.status(400).json({ error: 'El parámetro periodo es requerido.' });
    }

    try {
        const db = getDb();
        const registros = await db.collection('bss')
            .find({ importe_new: { $gt: 0 } })
            .sort({ empleado: 1 })
            .toArray();

        const bbvaRows = [];
        const otrosRows = [];
        let totalBBVA = 0;
        let totalOtros = 0;

        for (const r of registros) {
            const importe = Number(r.importe_new) || 0;
            const row = {
                empleado: r.empleado || '',
                nombre: r.nombre || '',
                rfc: r.rfc || '',
                clabe: r.clabe || '',
                banco: r.banco || '',
                importeFmt: fmtMxn(importe),
            };
            if (r.banco === '012') {
                bbvaRows.push(row);
                totalBBVA += importe;
            } else {
                otrosRows.push(row);
                totalOtros += importe;
            }
        }

        const totalGeneral = totalBBVA + totalOtros;
        const empleadosTotal = bbvaRows.length + otrosRows.length;

        const ahora = new Date();
        const dia = String(ahora.getDate()).padStart(2, '0');
        const mes = String(ahora.getMonth() + 1).padStart(2, '0');
        const anio = ahora.getFullYear();
        const hh = String(ahora.getHours()).padStart(2, '0');
        const mm = String(ahora.getMinutes()).padStart(2, '0');
        const fechaEmision = `${dia}/${mes}/${anio} ${hh}:${mm}`;

        const data = {
            periodo,
            fechaEmision,
            bbva: {
                rows: bbvaRows,
                empleados: bbvaRows.length,
                totalFmt: fmtMxn(totalBBVA),
            },
            otros: {
                rows: otrosRows,
                empleados: otrosRows.length,
                totalFmt: fmtMxn(totalOtros),
            },
            totales: {
                empleados: empleadosTotal,
                totalFmt: fmtMxn(totalGeneral),
            },
        };

        const templateHtml = fs.readFileSync(
            path.join(__dirname, '../templates/bss-revision.html')
        ).toString();

        const jsreport = await initJsReport();
        const result = await jsreport.render({
            template: {
                content: templateHtml,
                engine: 'handlebars',
                recipe: 'chrome-pdf',
            },
            data,
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `inline; filename=BSS_REVISION_${periodo}.pdf`
        );
        result.stream.pipe(res);
    } catch (err) {
        console.error('Error al generar PDF de revisión BSS:', err);
        res.status(500).json({ error: err.message || 'Error al generar el PDF.' });
    }
};