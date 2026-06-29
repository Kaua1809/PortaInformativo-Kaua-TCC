var express = require('express');
var router = express.Router();
const db = require('../db');

/* GET home page - busca as notícias (publicacoes) para exibir os cards */
router.get('/', function(req, res, next) {
  const sql = `
    SELECT id, titulo, descricao, foto, data_publicacao
    FROM publicacoes
    ORDER BY data_publicacao DESC
  `;

  db.query(sql, (err, noticias) => {
    if (err) {
      console.error('Erro ao buscar notícias:', err);
      return res.render('index', { title: 'IncluaNeuro', noticias: [] });
    }
    res.render('index', { title: 'IncluaNeuro', noticias: noticias });
  });
});

module.exports = router;