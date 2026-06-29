var express = require('express');
var router = express.Router();
const db = require('../db');

/* POST /contato - Recebe o formulário do modal de contato */
// Funciona com ou sem login (id_usuario fica NULL se não houver sessão).
router.post('/contato', function(req, res) {
  const { nome, sobrenome, email, telefone, relato } = req.body;

  if (!nome || !email || !relato) {
    return res.json({ sucesso: false, mensagem: 'Preencha nome, e-mail e o relato antes de enviar.' });
  }

  const idUsuario = (req.session.usuarioLogado) ? req.session.usuarioLogado.id : null;

  const sql = `
    INSERT INTO mensagens_contato (id_usuario, tipo, nome, sobrenome, email, telefone, relato)
    VALUES (?, 'contato', ?, ?, ?, ?, ?)
  `;

  db.query(sql, [idUsuario, nome, sobrenome || null, email, telefone || null, relato], (err) => {
    if (err) {
      console.error('Erro ao salvar contato:', err);
      return res.json({ sucesso: false, mensagem: 'Erro ao enviar. Tente novamente.' });
    }
    res.json({ sucesso: true, mensagem: 'Mensagem enviada com sucesso! Em breve entraremos em contato.' });
  });
});

/* POST /feedback - Recebe o formulário do modal de feedback */
// Funciona com ou sem login (id_usuario fica NULL se não houver sessão).
router.post('/feedback', function(req, res) {
  const { mensagem } = req.body;

  if (!mensagem || !mensagem.trim()) {
    return res.json({ sucesso: false, mensagem: 'Escreva seu feedback antes de enviar.' });
  }

  const idUsuario = (req.session.usuarioLogado) ? req.session.usuarioLogado.id : null;

  const sql = `
    INSERT INTO mensagens_contato (id_usuario, tipo, mensagem)
    VALUES (?, 'feedback', ?)
  `;

  db.query(sql, [idUsuario, mensagem.trim()], (err) => {
    if (err) {
      console.error('Erro ao salvar feedback:', err);
      return res.json({ sucesso: false, mensagem: 'Erro ao enviar. Tente novamente.' });
    }
    res.json({ sucesso: true, mensagem: 'Feedback enviado com sucesso! Obrigado por nos ajudar a melhorar.' });
  });
});

module.exports = router;
