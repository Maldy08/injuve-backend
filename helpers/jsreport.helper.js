const jsreport = require('jsreport')({
    extensions: { express: { enabled: false } }
  });
  
  let initialized = false;
  
  async function initJsReport() {
    if (!initialized) {
      await jsreport.init();
      
      initialized = true;
    }
    return jsreport;
  }
  
  module.exports = { initJsReport };