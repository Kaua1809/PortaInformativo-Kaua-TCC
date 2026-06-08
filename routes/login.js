var express = require('express');
var router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

// Rota para mostrar a página
router.get('/', function(req, res) {
  // Verifica se veio um parâmetro 'verificado' na URL para mostrar mensagem de sucesso
  let mensagemSucesso = null;
  if (req.query.verificado === 'true') {
    mensagemSucesso = 'E-mail verificado com sucesso! Agora você pode fazer login.';
  }
  
  res.render('login', { erro: null, sucesso: mensagemSucesso });
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
        // --- NOVA VERIFICAÇÃO AQUI ---
        if (!usuario.is_verified) {
          return res.render('login', { 
            erro: 'Sua conta ainda não foi ativada. Por favor, verifique seu e-mail!', 
            sucesso: null 
          });
        }
        // -----------------------------

        req.session.usuarioLogado = usuario;
        res.redirect('/');
      } else {
        res.render('login', { erro: 'Usuário ou senha incorretos!', sucesso: null });
      }
    } else {
      res.render('login', { erro: 'Usuário ou senha incorretos!', sucesso: null });
    }
  });
});

module.exports = router;
