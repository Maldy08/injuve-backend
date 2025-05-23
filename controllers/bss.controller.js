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
            totalGravado: item.totalGravado ||  (item.importe_new ? item.importe_new.toFixed(2) : '0.00'),
            totalExcento: item.totalExcento ||  '0.00'
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
