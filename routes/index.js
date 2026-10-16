var express = require('express');
var router = express.Router();
const db = require('../db');

const SUBTITULO = 'Site sobre a Hidrocefalia e a Mielomeningocele';

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
      return res.render('index', { title: 'IncluaNeuro ', subtitulo: SUBTITULO, noticias: [] });
    }
    res.render('index', { title: 'IncluaNeuro', subtitulo: SUBTITULO, noticias: noticias });
  });
});

module.exports = router;