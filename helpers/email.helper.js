const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,     // tu correo Gmail
    pass: process.env.EMAIL_PASS      // una contraseña de aplicación
  }
});

module.exports = transporter;