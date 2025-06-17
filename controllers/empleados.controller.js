
const { calcularAniosTrabajados, obtenerDiasVacaciones } = require('../helpers/empleados.helper');
const { getDb } = require('../helpers/mongo.helper');

exports.getEmpleados = async (req, res) => {
    const { tipo } = req.params;
    if (tipo !== '1' && tipo !== '2') {
        return res.status(400).json({ error: 'Tipo inválido. Debe ser 1 o 2.' });
    }
    try {
        const db = getDb();

        let empleados;
        if (tipo === '1') {
            empleados = await db.collection('mnom01').find({ VALIDEZ: 'V' }, {
                projection: {
                    _id: 0,
                    EMPLEADO: 1,
                    APPAT: 1,
                    APMAT: 1,
                    NOMBRE: 1,
                    RFC: 1,
                    CURP: 1,
                    EMAIL: 1
                }
            }).sort({ EMPLEADO: 1 }).toArray();
        } else {
            empleados = await db.collection('mnom01h').find({ VALIDEZ: 'V' }, {
                projection: {
                    _id: 0,
                    EMPLEADO: 1,
                    APPAT: 1,
                    APMAT: 1,
                    NOMBRE: 1,
                    RFC: 1,
                    CURP: 1,
                    EMAIL: 1
                }
            }).sort({ EMPLEADO: 1 }).toArray();
        }

        res.json(empleados);
    } catch (error) {
        console.error('Error al obtener empleados:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

exports.getEmpleadoById = async (req, res) => {
    const { id } = req.params;
    const { tipo } = req.params;
    if (tipo !== '1' && tipo !== '2') {
        return res.status(400).json({ error: 'Tipo inválido. Debe ser 1 o 2.' });
    }
    try {
        const db = getDb();

        let empleado;
        if (tipo == 1) {
            empleado = await db.collection('mnom01').findOne({ EMPLEADO: parseInt(req.params.id) }, { projection: { _id: 0 } });
        }
        else {
            empleado = await db.collection('mnom01h').findOne({ EMPLEADO: parseInt(req.params.id) }, { projection: { _id: 0 } });
        }
        if (empleado) {
            res.json(empleado);
        } else {
            res.status(404).json({ error: 'Empleado no encontrado' });
        }

    } catch (error) {
        console.error('Error al obtener empleado:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

exports.getEmpleadosVacaciones = async (req, res) => {
    try {
        const db = getDb();
        const empleados = await db.collection('mnom01').find({ VALIDEZ: 'V' }, {
            projection: {
                _id: 0,
                EMPLEADO: 1,
                FECHAALTA: 1,
                NOMBRE: 1,
                APPAT: 1,
                APMAT: 1,
                
            }
        }).sort({ EMPLEADO: 1 }).toArray();

        empleados.forEach(empleado => {
            empleado.ANIOS = calcularAniosTrabajados(empleado.FECHAALTA);
            empleado.DIASVACACIONES = empleado.ANIOS > 0 ? (obtenerDiasVacaciones(empleado.ANIOS) * 2) : 0;
        });

        // Crear workbook y worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('EMPLEADOS_VACACIONES');

        // Agregar logo (ajusta la ruta a tu logo)
        const logoPath = path.join(__dirname, '../public/logo.png');
        if (fs.existsSync(logoPath)) {
            const imageId = workbook.addImage({
                filename: logoPath,
                extension: 'png',
                size: { width: 120, height: 60 }
            });
            worksheet.addImage(imageId, {
                tl: { col: 0, row: 0 },
                ext: { width: 120, height: 60 }
            });
        }

        // Agregar encabezado grande en la fila 2
        worksheet.mergeCells('B2', 'G2');
        worksheet.getCell('B2').value = 'PROGRAMA DE VACACIONES 2025';
        worksheet.getCell('B2').font = { size: 16, bold: true };
        worksheet.getCell('B2').alignment = { vertical: 'middle', horizontal: 'center' };

        // Dejar filas vacías para separar logo/encabezado de los datos
        worksheet.addRow([]);
        worksheet.addRow([]);

        // Definir columnas (esto solo define las propiedades, no agrega la fila de headers)
        worksheet.columns = [
            { header: 'EMPLEADO', key: 'EMPLEADO', width: 10 },
            { header: 'FECHA_INGRESO', key: 'FECHAALTA', width: 15 },
            { header: 'NOMBRE', key: 'NOMBRE', width: 15 },
            { header: 'APPAT', key: 'APPAT', width: 15 },
            { header: 'APMAT', key: 'APMAT', width: 15 },
            { header: 'AÑOS', key: 'ANIOS', width: 10 },
            { header: 'DIAS_VACACIONES', key: 'DIASVACACIONES', width: 15 }
        ];

        // Agregar fila de encabezados en la fila 5
        worksheet.addRow(worksheet.columns.map(col => col.header));

        // Agregar los datos a partir de la fila 6
        empleados.forEach(emp => worksheet.addRow(emp));

        // Generar el archivo en memoria y enviarlo
        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = `PROGRAMA_DE_VACACIONES_2025.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    }
    catch (error) {
        console.error('Error al obtener empleados para vacaciones:', error);
        res.status(500).json({ error: 'Error interno del servidor'});
    }
}