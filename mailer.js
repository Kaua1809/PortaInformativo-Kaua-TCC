const nodemailer = require('nodemailer');

// CONFIGURAÇÃO DO GMAIL
// Substitua pelos seus dados reais
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'portal.informativo02@gmail.com', 
    pass: 'crqk cfcp vuhp kqrw' // Aquela que você gerou no Google
  }
});

module.exports = transporter;