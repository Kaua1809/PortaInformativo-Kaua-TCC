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

  // Postagens ocultadas pelo autor (oculta = 1) não aparecem no feed para os outros usuários.
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
      (SELECT COUNT(*) FROM comentarios WHERE postagem_id = pp.id AND comentario_pai_id IS NULL) as total_comentarios,
      (SELECT COUNT(*) FROM curtidas WHERE postagem_id = pp.id AND usuario_id = ?) as usuario_curtiu
    FROM postagem_pais pp
    LEFT JOIN usuario u ON pp.id_portal = u.id
    WHERE pp.oculta = 0
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

/* GET - Página de detalhes de uma postagem (comentario.ejs) */
router.get('/comentario/:id', verificarLogin, function(req, res, next) {
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

    // Busca apenas os comentários RAIZ (sem pai), com contagem de respostas e curtidas.
    // pode_excluir = true quando o usuário logado é o autor do comentário OU o dono da postagem.
    const donoPostagemId = postagens[0].id_portal;
    const sqlComentarios = `
      SELECT 
        c.*,
        u.login, u.foto_perfil,
        (SELECT COUNT(*) FROM comentarios r WHERE r.comentario_pai_id = c.id) as total_respostas,
        (SELECT COUNT(*) FROM curtidas WHERE comentario_id = c.id) as total_curtidas,
        (SELECT COUNT(*) FROM curtidas WHERE comentario_id = c.id AND usuario_id = ?) as usuario_curtiu,
        (c.usuario_id = ? OR ? = ?) as pode_excluir
      FROM comentarios c 
      JOIN usuario u ON c.usuario_id = u.id 
      WHERE c.postagem_id = ? AND c.comentario_pai_id IS NULL
      ORDER BY c.data_comentario DESC
    `;

    db.query(sqlComentarios, [usuarioLogado.id, usuarioLogado.id, usuarioLogado.id, donoPostagemId, postId], (err, comentarios) => {
      if (err) {
        console.error(err);
        return res.send('Erro ao carregar comentários');
      }
      res.render('comentario', {
        title: 'Comentários',
        postagem: postagens[0],
        comentarios: comentarios,
        usuarioLogado: usuarioLogado
      });
    });
  });
});

/* GET - Buscar respostas de um comentário específico (carregado via fetch, sob demanda) */
router.get('/respostas/:comentarioId', verificarLogin, function(req, res) {
  const comentarioId = req.params.comentarioId;
  const usuarioLogado = req.session.usuarioLogado;

  // pode_excluir = true quando o usuário logado é o autor da resposta OU o dono da postagem
  // (descobre o dono da postagem via JOIN: resposta -> comentario_pai -> postagem_pais.id_portal)
  const sql = `
    SELECT 
      c.*,
      u.login, u.foto_perfil,
      (SELECT COUNT(*) FROM curtidas WHERE comentario_id = c.id) as total_curtidas,
      (SELECT COUNT(*) FROM curtidas WHERE comentario_id = c.id AND usuario_id = ?) as usuario_curtiu,
      (c.usuario_id = ? OR ? = pp.id_portal) as pode_excluir
    FROM comentarios c
    JOIN usuario u ON c.usuario_id = u.id
    JOIN postagem_pais pp ON pp.id = c.postagem_id
    WHERE c.comentario_pai_id = ?
    ORDER BY c.data_comentario ASC
  `;

  db.query(sql, [usuarioLogado.id, usuarioLogado.id, usuarioLogado.id, comentarioId], (err, respostas) => {
    if (err) {
      console.error(err);
      return res.json({ sucesso: false });
    }
    res.json({ sucesso: true, respostas: respostas });
  });
});

/* DELETE - Excluir um comentário ou resposta */
// Permitido para: o autor do comentário OU o dono da postagem à qual o comentário pertence.
// Ao excluir um comentário raiz, as respostas dele também são excluídas (FK comentario_pai_id).
router.delete('/comentario/:id', verificarLogin, function(req, res) {
  const comentarioId = req.params.id;
  const usuarioId = req.session.usuarioLogado.id;

  const sqlVerifica = `
    SELECT c.id, c.usuario_id, pp.id_portal as dono_postagem_id
    FROM comentarios c
    JOIN postagem_pais pp ON pp.id = c.postagem_id
    WHERE c.id = ?
  `;

  db.query(sqlVerifica, [comentarioId], (err, results) => {
    if (err) {
      console.error(err);
      return res.json({ sucesso: false, mensagem: 'Erro ao verificar comentário.' });
    }
    if (!results[0]) return res.json({ sucesso: false, mensagem: 'Comentário não encontrado.' });

    const comentario = results[0];
    const podeExcluir = comentario.usuario_id === usuarioId || comentario.dono_postagem_id === usuarioId;

    if (!podeExcluir) {
      return res.json({ sucesso: false, mensagem: 'Você não tem permissão para excluir este comentário.' });
    }

    // Exclui primeiro as respostas (caso seja um comentário raiz) e depois o próprio comentário
    db.query('DELETE FROM comentarios WHERE comentario_pai_id = ?', [comentarioId], (err2) => {
      if (err2) {
        console.error(err2);
        return res.json({ sucesso: false, mensagem: 'Erro ao excluir respostas do comentário.' });
      }

      db.query('DELETE FROM comentarios WHERE id = ?', [comentarioId], (err3) => {
        if (err3) {
          console.error(err3);
          return res.json({ sucesso: false, mensagem: 'Erro ao excluir comentário.' });
        }
        res.json({ sucesso: true });
      });
    });
  });
});

/* POST - Curtir uma postagem ou um comentário */
// body esperado: { tipo: 'postagem' | 'comentario' }
router.post('/curtir/:id', verificarLogin, function(req, res) {
  const id = req.params.id;
  const usuarioId = req.session.usuarioLogado.id;
  const tipo = req.body.tipo === 'comentario' ? 'comentario' : 'postagem';

  const coluna = tipo === 'comentario' ? 'comentario_id' : 'postagem_id';

  db.query(`SELECT * FROM curtidas WHERE ${coluna} = ? AND usuario_id = ?`, [id, usuarioId], (err, results) => {
    if (err) {
      console.error(err);
      return res.json({ sucesso: false });
    }

    if (results.length > 0) {
      db.query(`DELETE FROM curtidas WHERE ${coluna} = ? AND usuario_id = ?`, [id, usuarioId], (err) => {
        if (err) {
          console.error(err);
          return res.json({ sucesso: false });
        }
        res.json({ sucesso: true, acao: 'descurtida' });
      });
    } else {
      db.query(`INSERT INTO curtidas (${coluna}, usuario_id) VALUES (?, ?)`, [id, usuarioId], (err) => {
        if (err) {
          console.error(err);
          return res.json({ sucesso: false });
        }
        res.json({ sucesso: true, acao: 'curtida' });
      });
    }
  });
});

/* POST - Adicionar comentário ou resposta */
// body esperado: { texto, comentario_pai_id? }
router.post('/comentar/:id', verificarLogin, function(req, res) {
  const { texto, comentario_pai_id } = req.body;
  const postId = req.params.id;
  const usuarioId = req.session.usuarioLogado.id;

  if (!texto || !texto.trim()) {
    return res.json({ sucesso: false, mensagem: 'Texto do comentário vazio.' });
  }

  const sql = 'INSERT INTO comentarios (postagem_id, comentario_pai_id, usuario_id, texto_comentario) VALUES (?, ?, ?, ?)';
  const pai = comentario_pai_id || null;

  db.query(sql, [postId, pai, usuarioId, texto.trim()], (err, resultado) => {
    if (err) {
      console.error(err);
      return res.json({ sucesso: false });
    }
    res.json({ sucesso: true, id: resultado.insertId });
  });
});

/* POST - Denunciar uma postagem ou um comentário */
// body esperado: { motivo, tipo: 'postagem' | 'comentario' }
router.post('/denunciar/:id', verificarLogin, function(req, res) {
  const id = req.params.id;
  const usuarioId = req.session.usuarioLogado.id;
  const { motivo, tipo } = req.body;

  if (!motivo || !motivo.trim()) {
    return res.json({ sucesso: false, mensagem: 'Motivo obrigatório.' });
  }

  const coluna = tipo === 'comentario' ? 'comentario_id' : 'postagem_id';
  const sql = `INSERT INTO denuncias (${coluna}, usuario_id, motivo) VALUES (?, ?, ?)`;

  db.query(sql, [id, usuarioId, motivo.trim()], (err) => {
    if (err) {
      console.error(err);
      return res.json({ sucesso: false });
    }
    res.json({ sucesso: true });
  });
});

/* GET - Página para criar nova postagem */
router.get('/criar-postagem', verificarLogin, function(req, res) {
  res.render('nova-postagem', { 
    title: 'Nova Postagem',
    usuarioLogado: req.session.usuarioLogado 
  });
});

/* POST - Criar nova postagem */
router.post('/criar-postagem', verificarLogin, upload.single('imagem'), function(req, res) {
  const usuarioId = req.session.usuarioLogado.id;
  const texto = req.body.texto;
  const imagem = req.file ? req.file.buffer : null;

  const sqlCheckPortal = 'INSERT IGNORE INTO portal_pais (id) VALUES (?)';

  db.query(sqlCheckPortal, [usuarioId], (err) => {
    if (err) {
      console.error("ERRO AO CRIAR PORTAL:", err);
      return res.json({ sucesso: false, mensagem: 'Erro ao preparar portal.' });
    }

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