const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    const endpoints = {
        auth: {
            basePath: '/api/backend/auth',
            routes: [
                { method: 'POST', path: '/login', description: 'Iniciar sesión con RFC' },
                { method: 'POST', path: '/loginMobile', description: 'Iniciar sesión móvil' },
                { method: 'GET', path: '/profile', description: 'Obtener perfil del usuario' }
            ]
        },
        nomina: {
            basePath: '/api/backend/nomina',
            routes: [
                { method: 'GET', path: '/recibos/:empleado/:tipo', description: 'Obtener resumen de recibos por empleado' },
                { method: 'GET', path: '/resumen/:tipo', description: 'Obtener resumen por periodo' },
                { method: 'GET', path: '/recibos/json/:empleado/:periodo/:tipo', description: 'Obtener JSON completo del recibo' },
                { method: 'GET', path: '/recibos/:tipo', description: 'Listar recibos' }
            ]
        },
        pdf: {
            basePath: '/api/backend/pdf',
            routes: [
                { method: 'GET', path: '/:empleado/:periodo/:tipo', description: 'Generar PDF de recibo' }
            ]
        },
        sendEmail: {
            basePath: '/api/backend/send-email',
            routes: [
                { method: 'POST', path: '/enviar-recibo', description: 'Enviar un recibo por correo' },
                { method: 'GET', path: '/enviar-recibos', description: 'Enviar múltiples recibos' }
            ]
        },
        empleados: {
            basePath: '/api/backend/empleados',
            routes: [
                { method: 'GET', path: '/vacaciones', description: 'Obtener empleados con vacaciones' },
                { method: 'GET', path: '/:tipo', description: 'Listar empleados por tipo' },
                { method: 'GET', path: '/:tipo/:id', description: 'Obtener empleado por ID' }
            ]
        },
        timbrado: {
            basePath: '/api/backend/timbrado',
            routes: [
                { method: 'GET', path: '/percepciones/:periodo', description: 'Reporte de percepciones por periodo' },
                { method: 'GET', path: '/:periodo/:tipo', description: 'Generar timbrado' },
                { method: 'GET', path: '/percepciones/json/:periodo', description: 'JSON de percepciones por periodo' }
            ]
        },
        bss: {
            basePath: '/api/backend/bss',
            routes: [
                { method: 'GET', path: '/exportar-zip/:periodo/:banco', description: 'Exportar ZIP para banco' },
                { method: 'GET', path: '/get-datos-bss', description: 'Obtener datos BSS' },
                { method: 'POST', path: '/upload', description: 'Subir archivo BSS' },
                { method: 'POST', path: '/actualizar', description: 'Actualizar datos BSS' }
            ]
        },
        notificaciones: {
            basePath: '/api/backend/notificaciones',
            routes: [
                { method: 'POST', path: '/recibos', description: 'Enviar notificaciones de recibos' },
                { method: 'POST', path: '/guardarToken', description: 'Guardar token FCM' }
            ]
        },
        upload: {
            basePath: '/api/backend/upload',
            routes: [
                { method: 'POST', path: '/:coleccion', description: 'Carga masiva de CSV a colección' }
            ]
        }
    };

    let html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>API Documentation</title>
        <style>
            :root {
                --primary: #2563eb;
                --bg: #f8fafc;
                --card-bg: #ffffff;
                --text: #1e293b;
                --text-secondary: #64748b;
                --border: #e2e8f0;
            }
            body {
                font-family: 'Segoe UI', system-ui, sans-serif;
                background-color: var(--bg);
                color: var(--text);
                margin: 0;
                padding: 2rem;
                line-height: 1.5;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
            }
            h1 {
                color: var(--primary);
                text-align: center;
                margin-bottom: 2rem;
                font-size: 2.5rem;
            }
            .grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                gap: 1.5rem;
            }
            .card {
                background: var(--card-bg);
                border-radius: 12px;
                padding: 1.5rem;
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                transition: transform 0.2s;
                border: 1px solid var(--border);
            }
            .card:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
            }
            .card-title {
                text-transform: capitalize;
                font-size: 1.25rem;
                font-weight: 700;
                color: var(--primary);
                margin-bottom: 1rem;
                border-bottom: 1px solid var(--border);
                padding-bottom: 0.5rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .badge {
                font-size: 0.75rem;
                background: #eff6ff;
                color: var(--primary);
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
            }
            .endpoint {
                margin-bottom: 0.75rem;
                padding: 0.5rem;
                background: #f1f5f9;
                border-radius: 6px;
                font-size: 0.9rem;
            }
            .method {
                font-weight: bold;
                margin-right: 0.5rem;
                padding: 0.2rem 0.4rem;
                border-radius: 4px;
                color: white;
                font-size: 0.75rem;
            }
            .GET { background-color: #0ea5e9; }
            .POST { background-color: #22c55e; }
            .PUT { background-color: #eab308; }
            .DELETE { background-color: #ef4444; }
            
            .path {
                font-family: monospace;
                color: #334155;
                word-break: break-all;
            }
            .desc {
                display: block;
                color: var(--text-secondary);
                font-size: 0.8rem;
                margin-top: 0.25rem;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📄 API Endpoints Directory</h1>
            <div class="grid">
    `;

    for (const [key, group] of Object.entries(endpoints)) {
        html += `
            <div class="card">
                <div class="card-title">
                    ${key}
                    <span class="badge">${group.basePath}</span>
                </div>
        `;
        
        group.routes.forEach(route => {
            html += `
                <div class="endpoint">
                    <div>
                        <span class="method ${route.method}">${route.method}</span>
                        <span class="path">${route.path}</span>
                    </div>
                    <span class="desc">${route.description}</span>
                </div>
            `;
        });

        html += `</div>`;
    }

    html += `
            </div>
        </div>
    </body>
    </html>
    `;

    res.send(html);
});

module.exports = router;
