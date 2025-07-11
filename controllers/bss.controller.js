const XLSX = require('xlsx');

const { create } = require('xmlbuilder2');
const { getDb } = require('../helpers/mongo.helper');

exports.uploadExcelBss = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const woorkbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = woorkbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(woorkbook.Sheets[sheetName], { raw: false });

    const db = getDb();
    const bssCollection = await db.collection('bss');
    for (const row of data) {
        if (!row.EMPLEADO || row.BSS === undefined) continue;
        const empleadoStr = String(row.EMPLEADO).padStart(3, '0');
        await bssCollection.updateOne(
            { empleado: empleadoStr },
            { $set: { importe_new: Number(row.BSS) } }
        );
    }
    res.json({ message: 'importe bss actualizado correctamente.' });

}


exports.exportarBssXml = async (req, res) => {
    const { periodo, banco } = req.params;

    if (!banco || !periodo) {
        return res.status(400).json({ error: 'Los parámetros banco y periodo son requeridos.' });
    }
    const filtado = banco !== "012" ? 'OTROS' : 'BBVA';
    const db = getDb();


    let query = {};
    if (filtado === 'BBVA') {
        query = { banco: "012" };
    } else {
        query = { banco: { $ne: "012" } };
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
        if (typeof nuevaFechaPago === 'string' && nuevaFechaPago.includes('/')) {
            const [dia, mes, anio] = nuevaFechaPago.split('/');
            // Usa el constructor Date correcto (mes base 0)
            const fechaObj = new Date(Number(anio), Number(mes) - 1, Number(dia));
            fechaObj.setDate(fechaObj.getDate() + 1);
            const diaF = String(fechaObj.getDate()).padStart(2, '0');
            const mesF = String(fechaObj.getMonth() + 1).padStart(2, '0');
            const anioF = fechaObj.getFullYear();
            nuevaFechaPago = `${diaF}/${mesF}/${anioF}`;
        } else {
            // Si viene en otro formato compatible con Date
            const fechaObj = new Date(nuevaFechaPago);
            fechaObj.setDate(fechaObj.getDate() + 1);
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
            ejercicio: '2025',
            fechaPago: nuevaFechaPago,
            fechaInicialPago: nuevaFechaPago,
            fechaFinalPago: nuevaFechaPago
        });

    bssCollection.forEach(item => {
        // Ajusta los nombres de los campos según tu colección
        if (item.importe_new !== 0) return; // Si el importe es 0, no generar pago

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
            totalExcento: item.totalExcento || (item.importe_new ? item.importe_new.toFixed(2) : '0.00')
        });

        percepciones.ele('percepcion', {
            tipoPercepcion: item.tipoPercepcion || '100',
            concepto: item.concepto || 'BONO DE SEGURIDAD SOCIAL',
            importeGravado: '0.00',
            importeExcento: item.importe_new ? item.importe_new.toFixed(2) : '0.00',
        });

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
    const filtado = banco !== "012" ? 'OTROS' : 'BBVA';
    const db = getDb();


    let query = {};
    if (filtado === 'BBVA') {
        query = { banco: "012" };
    } else {
        query = { banco: { $ne: "012" } };
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
        if (item.importe_new === 0) return ''; // Si el importe es 0, no generar línea
        return (
            fixed(consecutivo++, 9, '0', 'left') +                          // 1.- Numero consecutivo del registro (9)
            fixed(item.rfc, 16) +                                           // 2.- RFC del empleado (16)
            fixed(filtado === 'BBVA' ? '99' : '40') +                        // 3.- Tipo de cuenta (2)
            fixed(item.clabe, 20, ' ', 'rigth') +                     // 4.- Numero de cuenta (20)
            fixed(
                item.importe_new
                    ? String(Number(item.importe_new).toFixed(2)).replace('.', '')
                    : '0',
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
    const filtado = banco !== "012" ? 'OTROS' : 'BBVA';
    const db = getDb();

    // --- Genera el XML (igual que en exportarBssXml) ---
    let query = {};
    if (filtado === 'BBVA') {
        query = { banco: "012" };
    } else {
        query = { banco: { $ne: "012" } };
    }
    const bssCollection = await db.collection('bss').find(query).sort({ empleado: 1 }).toArray();

    // ...lógica de fecha...
    let nuevaFechaPago = new Date();
    const dia = String(nuevaFechaPago.getDate()).padStart(2, '0');
    const mes = String(nuevaFechaPago.getMonth() + 1).padStart(2, '0');
    const anio = nuevaFechaPago.getFullYear();
    nuevaFechaPago = `${dia}/${mes}/${anio}`;
    if (filtado !== 'BBVA') {
        if (typeof nuevaFechaPago === 'string' && nuevaFechaPago.includes('/')) {
            const [dia, mes, anio] = nuevaFechaPago.split('/');
            const fechaObj = new Date(Number(anio), Number(mes) - 1, Number(dia));
            fechaObj.setDate(fechaObj.getDate() + 1);
            const diaF = String(fechaObj.getDate()).padStart(2, '0');
            const mesF = String(fechaObj.getMonth() + 1).padStart(2, '0');
            const anioF = fechaObj.getFullYear();
            nuevaFechaPago = `${diaF}/${mesF}/${anioF}`;
        } else {
            const fechaObj = new Date(nuevaFechaPago);
            fechaObj.setDate(fechaObj.getDate() + 1);
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
            ejercicio: '2025',
            fechaPago: nuevaFechaPago,
            fechaInicialPago: nuevaFechaPago,
            fechaFinalPago: nuevaFechaPago
        });

    bssCollection.forEach(item => {

       // if (item.importe_new === 0) return; // Si el importe es 0, no generar pago  
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
            totalExcento: item.totalExcento || (item.importe_new ? item.importe_new.toFixed(2) : '0.00')
        });

        percepciones.ele('percepcion', {
            tipoPercepcion: item.tipoPercepcion || '100',
            concepto: item.concepto || 'BONO DE SEGURIDAD SOCIAL',
            importeGravado: '0.00',
            importeExcento: item.importe_new ? item.importe_new.toFixed(2) : '0.00',
        });
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
      //  if (item.importe_new === 0) return ''; // Si el importe es 0, no generar línea
        return (
            fixed(consecutivo++, 9, '0', 'left') +
            fixed(item.rfc, 16) +
            fixed(filtado === 'BBVA' ? '99' : '40') +
            fixed(item.clabe, 20, ' ', 'right') +
            fixed(
                item.importe_new
                    ? String(Number(item.importe_new).toFixed(2)).replace('.', '')
                    : '0',
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