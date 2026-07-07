var express = require('express');
var router = express.Router();
const db = require('../db');

/* GET mielomeningocele page - busca notícias aleatórias da tabela publicacoes */
router.get('/', function(req, res, next) {
  const sql = `
    SELECT id, titulo, descricao, foto
    FROM publicacoes
    ORDER BY RAND()
    LIMIT 3
  `;

  db.query(sql, (err, noticiasRelacionadas) => {
    if (err) {
      console.error('Erro ao buscar notícias relacionadas (mielomeningocele):', err);
      return res.render('mielomeningocele', { title: 'Mielomeningocele', noticiasRelacionadas: [] });
    }
    res.render('mielomeningocele', { title: 'Mielomeningocele', noticiasRelacionadas: noticiasRelacionadas });
  });
});

module.exports = router;