var express = require('express');
var router = express.Router();
const db = require('../db');

/* GET hidrocefalia page - busca notícias aleatórias da tabela publicacoes */
router.get('/', function(req, res, next) {
  const sql = `
    SELECT id, titulo, descricao, foto
    FROM publicacoes
    ORDER BY RAND()
    LIMIT 3
  `;

  db.query(sql, (err, noticiasRelacionadas) => {
    if (err) {
      console.error('Erro ao buscar notícias relacionadas (hidrocefalia):', err);
      return res.render('hidrocefalia', { title: 'Hidrocefalia', noticiasRelacionadas: [] });
    }
    res.render('hidrocefalia', { title: 'Hidrocefalia', noticiasRelacionadas: noticiasRelacionadas });
  });
});

module.exports = router;