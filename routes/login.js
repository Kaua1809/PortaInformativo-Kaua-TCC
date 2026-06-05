var express = require('express');
var router = express.Router(); // ESTA LINHA É A QUE ESTÁ FALTANDO
const db = require('../db');
const bcrypt = require('bcryptjs');

// Rota para mostrar a página
router.get('/', function(req, res) {
  res.render('login', { erro: null });
});

// Rota para processar o login
router.post('/', function(req, res) {
  const { login, senha } = req.body;

  const sql = 'SELECT * FROM Usuario WHERE login = ?';
  
  db.query(sql, [login], async (err, results) => {
    if (err) return res.send('Erro no banco');

    if (results.length > 0) {
      const usuario = results[0];
      const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

      if (senhaCorreta) {
        req.session.usuarioLogado = usuario;
        res.redirect('/');
      } else {
        res.render('login', { erro: 'Usuário ou senha incorretos!' });
      }
    } else {
      res.render('login', { erro: 'Usuário ou senha incorretos!' });
    }
  });
});

module.exports = router;
