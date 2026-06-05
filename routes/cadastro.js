var express = require('express');
var router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

router.get('/', function(req, res) {
  res.render('cadastro', { mensagem: null });
});

router.post('/', async function(req, res) {
  const { login, email, senha, ['confirmar-senha']: confirmarSenha } = req.body;

  if (senha !== confirmarSenha) {
    return res.render('cadastro', { mensagem: 'As senhas não coincidem!' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const senhaCripto = await bcrypt.hash(senha, salt);

    const sql = 'INSERT INTO Usuario (login, email, senha) VALUES (?, ?, ?)';
    db.query(sql, [login, email, senhaCripto], (err, result) => {
      if (err) {
        return res.render('cadastro', { mensagem: 'Erro ao cadastrar. Verifique se o email ou usuário já existem.' });
      }
      res.redirect('/conta');
    });
  } catch (error) {
    res.send('Erro no servidor');
  }
});

module.exports = router;
