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
    4
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
    const db = getDb();
    const bssCollection = await db.collection('bss').find().toArray();
    //const mnom01Collection = await db.collection('mnom01').find().toArray();

    const root = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('nomina', {
            version: '1.0',
            claveOrganismo: '10111',
            descripcion: 'INJUVE',
            periodo: 'PERIODO DE PAGO 10',
            tipoNomina: '160',
            ejercicio: '2025',
            fechaPago: '14/05/2025',
            fechaInicialPago: '14/05/2025',
            fechaFinalPago: '14/05/2025'
        });

    bssCollection.forEach(item => {
        // Ajusta los nombres de los campos según tu colección
        const pago = root.ele('pago', {
            numEmpleado: item.empleado || '',
            nombreCompleto: item.nombre || '',
            curp: item.curp || '',
            tipoRegimen: item.tiporegimen || '',
            numSeguridadSocial: item.isstecali || '',
            numDiasPagados: '14',
            departamento: item.departamento || '',
            clabe: item.clabe || '',
            banco: item.banco || '',
            periodicidadPago: item.periodicidadPago || ''
        });

        const percepciones = pago.ele('percepciones', {
            totalGravado: item.totalGravado || (item.importe_new ? item.importe_new.toFixed(2) : '0.00'),
            totalExcento: item.totalExcento || '0.00'
        });

        percepciones.ele('percepcion', {
            tipoPercepcion: item.tipoPercepcion || '100',
            concepto: item.concepto || 'BONO DE SEGURIDAD SOCIAL',
            importeGravado: item.importe_new ? item.importe_new.toFixed(2) : '0.00',
            importeExcento: '0.00'
        });
    });

    const xml = root.end({ prettyPrint: false });

    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);

}

exports.exportarBssTxt = async (req, res) => {
    const { banco } = req.params;
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
        return (
            fixed(consecutivo++, 9, '0', 'left') +                          // 1.- Numero consecutivo del registro (9)
            fixed(item.rfc, 16) +                                           // 2.- RFC del empleado (16)
            fixed(filtado === 'BBVA' ? '99' : '40') +                        // 3.- Tipo de cuenta (2)
            fixed(item.clabe, 20, ' ', 'rigth') +                     // 4.- Numero de cuenta (20)
            fixed(
                item.importe_new
                    ? String(item.importe_new).replace('.', '')
                    : '0',
                15, '0', 'left'
            ) +                                                           // 5.- Importe a pagar (15, sin decimales)
            fixed(item.nombre, 40) +                                        // 6.- Nombre trabajador (40)
            fixed(item.banco, 3, '0', 'left') +                      // 7.- Banco destino (3)
            fixed('001', 3, '0', 'left')                        // 8.- Plaza destino (3)
        );
    });

    const txt = lines.join('\n');

    res.setHeader('Content-Disposition', 'attachment; filename=layout_nomina.txt');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(txt);
};
