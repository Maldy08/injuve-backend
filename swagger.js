const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API de Recibos de Nómina',
      version: '1.0.0',
      description: 'Documentación de la API del sistema de recibos de nómina',
    },
    servers: [
      {
        url: 'http://localhost:3001/api',
      },
    ],
  },
  apis: ['./routes/*.js'], // aquí busca anotaciones en tus archivos de rutas
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };