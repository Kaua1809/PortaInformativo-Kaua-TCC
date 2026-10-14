require('dotenv').config();
const mysql = require('mysql2');

const conexao = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'portal_informativo',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 5,
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