var express = require('express');
var router = express.Router();
const db = require('../db');
const multer = require('multer');

// Configurar multer para upload de imagens
const upload = multer({
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

// Middleware para verificar se o usuário está logado
function verificarLogin(req, res, next) {
  if (!req.session.usuarioLogado) {
    return res.redirect('/login');
  }
  next();
}

/* GET - Página principal do portal com feed de postagens */
router.get('/', verificarLogin, function(req, res, next) {
  const usuarioLogado = req.session.usuarioLogado;

  const sql = `
    SELECT 
      pp.id,
      pp.id_portal,
      pp.comentarios,
      pp.fotos,
      pp.data_postagem,
      u.id as usuario_id,
      u.login,
      u.foto_perfil,
      (SELECT COUNT(*) FROM curtidas WHERE postagem_id = pp.id) as total_curtidas,
      (SELECT COUNT(*) FROM comentarios WHERE postagem_id = pp.id) as total_comentarios,
      (SELECT COUNT(*) FROM curtidas WHERE postagem_id = pp.id AND usuario_id = ?) as usuario_curtiu
    FROM postagem_pais pp
    LEFT JOIN usuario u ON pp.id_portal = u.id
    ORDER BY pp.data_postagem DESC
  `;

  db.query(sql, [usuarioLogado.id], (err, postagens) => {
    if (err) {
      console.error(err);
      return res.send('Erro ao carregar postagens');
    }
    res.render('responsavel', { 
      title: 'Portal da Inclusão',
      postagens: postagens,
      usuarioLogado: usuarioLogado
    });
  });
});

/* GET - Página de detalhes de uma postagem */
router.get('/post/:id', verificarLogin, function(req, res, next) {
  const postId = req.params.id;
  const usuarioLogado = req.session.usuarioLogado;

  const sqlPostagem = `
    SELECT 
      pp.id, pp.id_portal, pp.comentarios, pp.fotos, pp.data_postagem,
      u.login, u.foto_perfil,
      (SELECT COUNT(*) FROM curtidas WHERE postagem_id = pp.id) as total_curtidas,
      (SELECT COUNT(*) FROM curtidas WHERE postagem_id = pp.id AND usuario_id = ?) as usuario_curtiu
    FROM postagem_pais pp
    LEFT JOIN usuario u ON pp.id_portal = u.id
    WHERE pp.id = ?
  `;

  db.query(sqlPostagem, [usuarioLogado.id, postId], (err, postagens) => {
    if (err || postagens.length === 0) return res.send('Postagem não encontrada');

    const sqlComentarios = `
      SELECT c.*, u.login, u.foto_perfil 
      FROM comentarios c 
      JOIN usuario u ON c.usuario_id = u.id 
      WHERE c.postagem_id = ? 
      ORDER BY c.data_comentario DESC
    `;

    db.query(sqlComentarios, [postId], (err, comentarios) => {
      res.render('post-detalhes', {
        postagem: postagens[0],
        comentarios: comentarios,
        usuarioLogado: usuarioLogado
      });
    });
  });
});

/* POST - Curtir uma postagem */
router.post('/curtir/:id', verificarLogin, function(req, res) {
  const postId = req.params.id;
  const usuarioId = req.session.usuarioLogado.id;

  db.query('SELECT * FROM curtidas WHERE postagem_id = ? AND usuario_id = ?', [postId, usuarioId], (err, results) => {
    if (results.length > 0) {
      db.query('DELETE FROM curtidas WHERE postagem_id = ? AND usuario_id = ?', [postId, usuarioId], () => {
        res.json({ sucesso: true, acao: 'descurtida' });
      });
    } else {
      db.query('INSERT INTO curtidas (postagem_id, usuario_id) VALUES (?, ?)', [postId, usuarioId], () => {
        res.json({ sucesso: true, acao: 'curtida' });
      });
    }
  });
});

/* POST - Adicionar comentário */
router.post('/comentar/:id', verificarLogin, function(req, res) {
  const { texto } = req.body;
  const postId = req.params.id;
  const usuarioId = req.session.usuarioLogado.id;

  db.query('INSERT INTO comentarios (postagem_id, usuario_id, texto_comentario) VALUES (?, ?, ?)', [postId, usuarioId, texto], (err) => {
    if (err) return res.json({ sucesso: false });
    res.json({ sucesso: true });
  });
});

/* POST - Denunciar */
router.post('/denunciar/:id', verificarLogin, function(req, res) {
  const { motivo } = req.body;
  db.query('INSERT INTO denuncias (postagem_id, usuario_id, motivo) VALUES (?, ?, ?)', [req.params.id, req.session.usuarioLogado.id, motivo], (err) => {
    if (err) return res.json({ sucesso: false });
    res.json({ sucesso: true });
  });
});

/* GET - Página para criar nova postagem */
router.get('/criar-postagem', verificarLogin, function(req, res) {
  res.render('nova-postagem', { 
    title: 'Nova Postagem', // Adicionando o título que a navbar espera
    usuarioLogado: req.session.usuarioLogado 
  });
});

/* POST - Criar nova postagem */
router.post('/criar-postagem', verificarLogin, upload.single('imagem'), function(req, res) {
  const usuarioId = req.session.usuarioLogado.id;
  const texto = req.body.texto;
  const imagem = req.file ? req.file.buffer : null;

  // 1. Primeiro, garantimos que o registro na tabela portal_pais exista
  // Usamos 'INSERT IGNORE' ou verificamos se já existe para evitar o erro de chave estrangeira
  const sqlCheckPortal = 'INSERT IGNORE INTO portal_pais (id) VALUES (?)';
  
  db.query(sqlCheckPortal, [usuarioId], (err) => {
    if (err) {
      console.error("ERRO AO CRIAR PORTAL:", err);
      return res.json({ sucesso: false, mensagem: 'Erro ao preparar portal.' });
    }

    // 2. Agora que temos certeza que o ID existe em portal_pais, fazemos a postagem
    const sqlPost = 'INSERT INTO postagem_pais (id_portal, comentarios, fotos, data_postagem) VALUES (?, ?, ?, NOW())';
    
    db.query(sqlPost, [usuarioId, texto, imagem], (err) => {
      if (err) {
        console.error("ERRO NO BANCO AO POSTAR:", err);
        return res.json({ sucesso: false, mensagem: 'Erro ao salvar postagem: ' + err.message });
      }
      res.json({ sucesso: true });
    });
  });
});

module.exports = router;
