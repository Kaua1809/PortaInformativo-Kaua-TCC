var express = require('express');
var router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const transporter = require('../mailer'); // Importando seu mailer existente

// 1. Configuração do Multer (foto de perfil - salva em disco)
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, 'public/uploads/'); },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, 'perfil-' + req.session.usuarioLogado.id + '-' + uniqueSuffix);
  }
});
const upload = multer({ storage: storage });

// 1b. Configuração do Multer para imagens de publicação (memória -> salva como BLOB no banco,
// igual ao padrão já usado em responsavel.js para a coluna 'fotos')
const uploadPublicacao = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  }
});

// 2. GET /conta - Visualizar
router.get('/', function(req, res) {
  if (!req.session.usuarioLogado) return res.redirect('/login');
  const sql = 'SELECT * FROM usuario WHERE id = ?';
  db.query(sql, [req.session.usuarioLogado.id], (err, results) => {
    if (err) return res.send('Erro ao buscar dados');

    const usuario = results[0];

    // 'id_portal' em postagem_pais guarda o id do próprio usuário (não é uma FK para portal_pais).
    // total_comentarios soma comentários raiz + respostas (todas as linhas da postagem na tabela comentarios).
    // Aqui trazemos TODAS as publicações do usuário, incluindo as ocultas (ele precisa vê-las pra poder desocultar).
    const sqlPublicacoes = `
      SELECT
        pp.id,
        pp.comentarios,
        pp.fotos,
        pp.data_postagem,
        pp.oculta,
        (SELECT COUNT(*) FROM curtidas WHERE postagem_id = pp.id) as total_curtidas,
        (SELECT COUNT(*) FROM comentarios WHERE postagem_id = pp.id) as total_comentarios
      FROM postagem_pais pp
      WHERE pp.id_portal = ?
      ORDER BY pp.data_postagem DESC
    `;
    db.query(sqlPublicacoes, [usuario.id], (err2, publicacoes) => {
      if (err2) {
        console.log('Erro ao buscar publicações:', err2);
        return res.render('conta', { usuario, publicacoes: [], editMode: false, title: 'Minha Conta' });
      }
      res.render('conta', { usuario, publicacoes, editMode: false, title: 'Minha Conta' });
    });
  });
});

// 2b. GET /conta/logout - Encerrar sessão (sair da conta)
router.get('/logout', function(req, res) {
  req.session.destroy(function(err) {
    if (err) {
      console.error('Erro ao encerrar sessão:', err);
      return res.redirect('/conta');
    }
    res.redirect('/login');
  });
});

// 3. GET /conta/editar - Abrir formulário
router.get('/editar', function(req, res) {
  if (!req.session.usuarioLogado) return res.redirect('/login');
  const sql = 'SELECT * FROM usuario WHERE id = ?';
  db.query(sql, [req.session.usuarioLogado.id], (err, results) => {
    if (err) return res.send('Erro ao buscar dados');
    res.render('conta', { usuario: results[0], editMode: true, title: 'Editar Perfil' });
  });
});

// 4. POST /conta/editar - Salvar
router.post('/editar', upload.single('foto_perfil'), function(req, res) {
  if (!req.session.usuarioLogado) return res.redirect('/login');
  const userId = req.session.usuarioLogado.id;
  const { login, bio, data_nascimento, genero } = req.body;
  const nascimentoFinal = (data_nascimento && data_nascimento !== "") ? data_nascimento : null;
  const generoFinal = (genero && genero !== "") ? genero : null;

  let sql, params;
  if (req.file) {
    const fotoCaminho = '/uploads/' + req.file.filename;
    sql = "UPDATE usuario SET login = ?, bio = ?, foto_perfil = ?, data_nascimento = ?, genero = ? WHERE id = ?";
    params = [login, bio, fotoCaminho, nascimentoFinal, generoFinal, userId];
    req.session.usuarioLogado.foto_perfil = fotoCaminho;
  } else {
    sql = "UPDATE usuario SET login = ?, bio = ?, data_nascimento = ?, genero = ? WHERE id = ?";
    params = [login, bio, nascimentoFinal, generoFinal, userId];
  }

  db.query(sql, params, (err) => {
    if (err) return res.status(500).send("Erro ao salvar: " + err.message);
    req.session.usuarioLogado.login = login;
    res.redirect("/conta");
  });
});

// 5. POST /conta/notificacoes - AJAX
router.post('/notificacoes', function(req, res) {
  if (!req.session.usuarioLogado) return res.json({ sucesso: false });
  const { ativo } = req.body;
  const sql = "UPDATE usuario SET notificacoes_ativas = ? WHERE id = ?";
  db.query(sql, [ativo ? 1 : 0, req.session.usuarioLogado.id], (err) => {
    res.json({ sucesso: !err });
  });
});

// 6. POST /conta/redefinir-senha - ENVIO DE E-MAIL REAL
router.post('/redefinir-senha', function(req, res) {
  if (!req.session.usuarioLogado) return res.json({ sucesso: false });
  
  const { email, login } = req.session.usuarioLogado;

  const mailOptions = {
    from: '"Portal Informativo" <Portal.Informativo02@gmail.com>',
    to: email,
    subject: 'Restauração de Senha - Portal Informativo',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
          <h2 style="color: #333; text-align: center;">Restauração de Senha</h2>
          <p style="font-size: 16px; color: #555;">Olá, <strong>${login}</strong>!</p>
          <p style="font-size: 16px; color: #555;">Você solicitou a restauração de sua senha no nosso portal. Clique no botão abaixo para criar uma nova senha:</p>
          <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:3000/redefinir-senha?email=${email}" 
                 style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                 Criar Nova Senha
              </a>
          </div>
          <p style="font-size: 14px; color: #888; text-align: center;">Se você não solicitou isso, pode ignorar este e-mail com segurança.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #aaa; text-align: center;">&copy; 2026 Portal Informativo - TCC</p>
      </div>
    `
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('Erro ao enviar e-mail de restauração:', error);
      return res.json({ sucesso: false, mensagem: 'Erro ao enviar o e-mail.' });
    }
    res.json({ sucesso: true, mensagem: 'E-mail de restauração enviado com sucesso!' });
  });
});

// 7. POST /conta/deletar - AJAX
router.post('/deletar', function(req, res) {
  if (!req.session.usuarioLogado) return res.json({ sucesso: false });
  const { senha } = req.body;
  const userId = req.session.usuarioLogado.id;

  const sqlBusca = "SELECT senha FROM usuario WHERE id = ?";
  db.query(sqlBusca, [userId], async (err, results) => {
    if (results[0]) {
        // Usando bcryptjs conforme seu arquivo de cadastro
        const bcrypt = require('bcryptjs');
        const senhaValida = await bcrypt.compare(senha, results[0].senha);
        
        if (senhaValida) {
            db.query("DELETE FROM usuario WHERE id = ?", [userId], (err) => {
                req.session.destroy();
                res.json({ sucesso: true });
            });
        } else {
            res.json({ sucesso: false, mensagem: 'Senha incorreta!' });
        }
    } else {
        res.json({ sucesso: false, mensagem: 'Usuário não encontrado!' });
    }
  });
});

// 8. DELETE /conta/publicacoes/:id - Excluir publicação
router.delete('/publicacoes/:id', function(req, res) {
  if (!req.session.usuarioLogado) return res.json({ sucesso: false });

  const postagemId = req.params.id;
  const userId = req.session.usuarioLogado.id;

  // Confere se a publicação pertence ao usuário logado antes de excluir
  const sqlVerifica = 'SELECT id FROM postagem_pais WHERE id = ? AND id_portal = ?';
  db.query(sqlVerifica, [postagemId, userId], (err, results) => {
    if (err) return res.json({ sucesso: false, mensagem: 'Erro ao verificar publicação.' });
    if (!results[0]) return res.json({ sucesso: false, mensagem: 'Publicação não encontrada.' });

    db.query('DELETE FROM postagem_pais WHERE id = ?', [postagemId], (err2) => {
      if (err2) return res.json({ sucesso: false, mensagem: 'Erro ao excluir publicação.' });
      res.json({ sucesso: true });
    });
  });
});

// 9. GET /conta/publicacoes/:id/editar - Abrir formulário de edição da publicação
router.get('/publicacoes/:id/editar', function(req, res) {
  if (!req.session.usuarioLogado) return res.redirect('/login');

  const postagemId = req.params.id;
  const userId = req.session.usuarioLogado.id;

  const sql = 'SELECT * FROM postagem_pais WHERE id = ? AND id_portal = ?';
  db.query(sql, [postagemId, userId], (err, results) => {
    if (err) return res.send('Erro ao buscar publicação.');
    if (!results[0]) return res.send('Publicação não encontrada.');

    const publicacao = results[0];
    // Converte o BLOB para base64 para exibir como prévia na tela de edição (mesmo padrão usado em comentario.ejs)
    const imagemBase64 = publicacao.fotos ? publicacao.fotos.toString('base64') : null;

    res.render('editar-publicacao', {
      title: 'Editar Postagem',
      publicacao: publicacao,
      imagemBase64: imagemBase64,
      usuarioLogado: req.session.usuarioLogado
    });
  });
});

// 10. POST /conta/publicacoes/:id/editar - Salvar edição da publicação
// Imagem é opcional: se o usuário não enviar um arquivo novo, mantém a imagem (fotos) já salva.
router.post('/publicacoes/:id/editar', uploadPublicacao.single('imagem'), function(req, res) {
  if (!req.session.usuarioLogado) return res.redirect('/login');

  const postagemId = req.params.id;
  const userId = req.session.usuarioLogado.id;
  const texto = req.body.texto;
  const novaImagem = req.file ? req.file.buffer : null;

  let sql, params;
  if (novaImagem) {
    sql = 'UPDATE postagem_pais SET comentarios = ?, fotos = ? WHERE id = ? AND id_portal = ?';
    params = [texto, novaImagem, postagemId, userId];
  } else {
    sql = 'UPDATE postagem_pais SET comentarios = ? WHERE id = ? AND id_portal = ?';
    params = [texto, postagemId, userId];
  }

  db.query(sql, params, (err) => {
    if (err) return res.status(500).send('Erro ao salvar: ' + err.message);
    res.redirect('/conta');
  });
});

// 11. POST /conta/publicacoes/:id/ocultar - Alterna entre oculta/visível (toggle)
// Quando oculta, a postagem não aparece no feed do fórum (responsavel.js) nem na lista de "Suas publicações"... 
// na verdade ela continua aparecendo aqui em "Suas publicações" (marcada como oculta), só não aparece pro resto dos usuários.
router.post('/publicacoes/:id/ocultar', function(req, res) {
  if (!req.session.usuarioLogado) return res.json({ sucesso: false });

  const postagemId = req.params.id;
  const userId = req.session.usuarioLogado.id;

  const sqlVerifica = 'SELECT id, oculta FROM postagem_pais WHERE id = ? AND id_portal = ?';
  db.query(sqlVerifica, [postagemId, userId], (err, results) => {
    if (err) return res.json({ sucesso: false, mensagem: 'Erro ao verificar publicação.' });
    if (!results[0]) return res.json({ sucesso: false, mensagem: 'Publicação não encontrada.' });

    const novoEstado = results[0].oculta ? 0 : 1;

    db.query('UPDATE postagem_pais SET oculta = ? WHERE id = ?', [novoEstado, postagemId], (err2) => {
      if (err2) return res.json({ sucesso: false, mensagem: 'Erro ao atualizar publicação.' });
      res.json({ sucesso: true, oculta: novoEstado === 1 });
    });
  });
});

module.exports = router;