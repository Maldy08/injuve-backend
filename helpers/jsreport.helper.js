const path = require('path');

// 1. Tu configuración base (aplica para Mac y el EC2 en AWS)
const jsreportConfig = {
  extensions: { express: { enabled: false } }
};

// 2. El parche exclusivo para tu máquina con Windows
if (process.platform === 'win32') {
  // Crea la carpeta temporal en la raíz de tu proyecto (un nivel arriba de /helpers)
  jsreportConfig.tempDirectory = path.join(__dirname, '../jsreport-temp');
  
  // Permisos para que Chromium lea archivos locales en Windows
  jsreportConfig.chrome = {
    launchOptions: {
      args: ['--allow-file-access-from-files']
    }
  };
}

// 3. Inicializamos jsreport pasándole la configuración final
const jsreport = require('jsreport')(jsreportConfig);

let initialized = false;

async function initJsReport() {
  if (!initialized) {
    await jsreport.init();
    initialized = true;
  }
  return jsreport;
}

module.exports = { initJsReport };