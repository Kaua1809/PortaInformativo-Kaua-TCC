const mysql = require('mysql2');

const conexao = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: '18092008Kaua!',
  database: 'portal_informativo',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

conexao.getConnection((erro, conn) => {
  if (erro) {
    console.error('Erro ao conectar:', erro);
  } else {
    console.log('Conectado ao banco!');
    conn.release();
  }
});

module.exports = conexao;