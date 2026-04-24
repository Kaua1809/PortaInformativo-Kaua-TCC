const mysql = require('mysql2');

const conexao = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '18092008Kaua!', 
  database: 'portal_informativo'
});

conexao.connect((erro) => {
  if (erro) {
    console.error('Erro ao conectar:', erro);
  } else {
    console.log('Conectado ao banco!');
  }
});

module.exports = conexao;