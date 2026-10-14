var express = require('express');
var router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const transporter = require('../mailer');

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
        if (!usuario.is_verified) {
          return res.render('login', { 
            erro: 'Sua conta ainda não foi ativada. Por favor, verifique seu e-mail!', 
            sucesso: null 
          });
        }

        if (usuario.banido) {
          return res.render('login', {
            erro: 'Esta conta foi banida por violar as diretrizes do portal.',
            sucesso: null
          });
        }

        if (usuario.suspenso_ate && new Date(usuario.suspenso_ate) > new Date()) {
          const dataFormatada = new Date(usuario.suspenso_ate).toLocaleDateString('pt-BR');
          return res.render('login', {
            erro: 'Sua conta está suspensa até ' + dataFormatada + '.',
            sucesso: null
          });
        }

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

// POST /login/esqueci-senha - Gera token seguro e envia e-mail (rota pública, sem sessão)
router.post('/esqueci-senha', function(req, res) {
  const { login } = req.body;

  if (!login || !login.trim()) {
    return res.json({ sucesso: false, mensagem: 'Digite seu nome de usuário.' });
  }

  db.query('SELECT id, email, login FROM usuario WHERE login = ?', [login.trim()], (err, results) => {
    if (err) {
      console.error(err);
      return res.json({ sucesso: false, mensagem: 'Erro ao processar sua solicitação.' });
    }

    // Mensagem genérica mesmo se o usuário não existir, pra não revelar quais nomes de usuário são válidos
    const mensagemPadrao = 'Se esse nome de usuário existir, um link de redefinição foi enviado para o e-mail cadastrado.';

    if (results.length === 0) {
      return res.json({ sucesso: true, mensagem: mensagemPadrao });
    }

    const usuario = results[0];

    const tokenBruto = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(tokenBruto).digest('hex');
    const expira = new Date(Date.now() + 60 * 60 * 1000); // válido por 1 hora

    db.query('UPDATE usuario SET reset_token = ?, reset_token_expira = ? WHERE id = ?', [tokenHash, expira, usuario.id], (errUpdate) => {
      if (errUpdate) {
        console.error(errUpdate);
        return res.json({ sucesso: true, mensagem: mensagemPadrao });
      }

      const link = `http://localhost:3000/redefinir-senha/${tokenBruto}`;

      transporter.sendMail({
        from: '"Portal Informativo" <portal.informativo02@gmail.com>',
        to: usuario.email,
        subject: 'Restauração de Senha - Portal Informativo',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
              <h2 style="color: #333; text-align: center;">Restauração de Senha</h2>
              <p style="font-size: 16px; color: #555;">Olá, <strong>${usuario.login}</strong>!</p>
              <p style="font-size: 16px; color: #555;">Você solicitou a restauração de sua senha no nosso portal. Clique no botão abaixo para criar uma nova senha. Este link é válido por 1 hora e só pode ser usado uma vez:</p>
              <div style="text-align: center; margin: 30px 0;">
                  <a href="${link}" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Criar Nova Senha</a>
              </div>
              <p style="font-size: 14px; color: #888; text-align: center;">Se você não solicitou isso, pode ignorar este e-mail com segurança.</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #aaa; text-align: center;">&copy; 2026 Portal Informativo - TCC</p>
          </div>
        `
      }, (error) => {
        if (error) console.log('Erro ao enviar e-mail de restauração:', error);
        res.json({ sucesso: true, mensagem: mensagemPadrao });
      });
    });
  });
});

module.exports = router;
