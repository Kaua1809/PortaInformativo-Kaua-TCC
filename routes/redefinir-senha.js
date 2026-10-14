var express = require('express');
var router = express.Router();
const db = require('../db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// GET /redefinir-senha/:token - mostra o formulário de nova senha, se o token ainda for válido
router.get('/:token', function(req, res) {
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');

  db.query(
    'SELECT id FROM usuario WHERE reset_token = ? AND reset_token_expira > NOW()',
    [tokenHash],
    (err, results) => {
      if (err || !results[0]) {
        return res.render('redefinir-senha-form', { valido: false, token: null, title: 'Redefinir Senha', erro: null });
      }
      res.render('redefinir-senha-form', { valido: true, token: req.params.token, title: 'Redefinir Senha', erro: null });
    }
  );
});

// POST /redefinir-senha/:token - valida de novo e efetiva a troca
router.post('/:token', function(req, res) {
  const { novaSenha, confirmarSenha } = req.body;
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');

  if (!novaSenha || novaSenha.length < 6) {
    return res.render('redefinir-senha-form', {
      valido: true, token: req.params.token, title: 'Redefinir Senha',
      erro: 'A senha deve ter pelo menos 6 caracteres.'
    });
  }
  if (novaSenha !== confirmarSenha) {
    return res.render('redefinir-senha-form', {
      valido: true, token: req.params.token, title: 'Redefinir Senha',
      erro: 'As senhas não coincidem.'
    });
  }

  // Revalida o token no momento do envio (evita usar um link que expirou entre abrir a página e enviar o form)
  db.query(
    'SELECT id FROM usuario WHERE reset_token = ? AND reset_token_expira > NOW()',
    [tokenHash],
    async (err, results) => {
      if (err || !results[0]) {
        return res.render('redefinir-senha-form', { valido: false, token: null, title: 'Redefinir Senha', erro: null });
      }

      try {
        const novoHash = await bcrypt.hash(novaSenha, 10);
        db.query(
          'UPDATE usuario SET senha = ?, reset_token = NULL, reset_token_expira = NULL WHERE id = ?',
          [novoHash, results[0].id],
          (err2) => {
            if (err2) return res.send('Erro ao redefinir senha.');
            // Token é de uso único: já foi zerado no banco acima.
            res.redirect('/login?redefinida=1');
          }
        );
      } catch (e) {
        res.send('Erro ao redefinir senha.');
      }
    }
  );
});

module.exports = router;
