var express = require('express');
var router = express.Router();
const db = require('../db');
const multer = require('multer');
const verificarAdmin = require('../verificarAdmin');

// IMPORTANTE: para o middleware verificarAdmin funcionar, a rota de LOGIN
// precisa salvar 'is_admin' dentro de req.session.usuarioLogado, por exemplo:
//   req.session.usuarioLogado = { id: usuario.id, login: usuario.login, is_admin: usuario.is_admin, ... };

// Sanitiza o HTML do editor rico: permite SOMENTE <strong>, <b>, <em>, <br>
// (negrito/itálico/quebra de linha). Remove qualquer outra tag (inclusive
// <script>), prevenindo injeção de HTML malicioso mesmo vindo de um admin.
function sanitizarHtmlBloco(html) {
  if (!html) return html;
  // Remove todas as tags exceto as permitidas
  return html.replace(/<(?!\/?(strong|b|em|br)\b)[^>]*>/gi, '');
}

// upload.any() aceita um número variável de arquivos, com nomes de campo
// dinâmicos (ex: imagem_capa, bloco_imagem_0, bloco_imagem_1, ...)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB por arquivo
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  }
});

/* GET /noticias/:id - Página de leitura do artigo completo (estilo G1) */
router.get('/:id', function(req, res) {
  const noticiaId = req.params.id;

  const sqlNoticia = `
    SELECT p.*, u.login as autor_login
    FROM publicacoes p
    LEFT JOIN usuario u ON p.id_autor = u.id
    WHERE p.id = ?
  `;

  db.query(sqlNoticia, [noticiaId], (err, results) => {
    if (err) {
      console.error(err);
      return res.send('Erro ao buscar notícia.');
    }
    if (!results[0]) return res.status(404).send('Notícia não encontrada.');

    const sqlBlocos = 'SELECT * FROM noticia_blocos WHERE id_noticia = ? ORDER BY ordem ASC';
    db.query(sqlBlocos, [noticiaId], (err2, blocos) => {
      if (err2) {
        console.error(err2);
        return res.send('Erro ao buscar conteúdo da notícia.');
      }

      res.render('noticia', {
        title: results[0].titulo,
        noticia: results[0],
        blocos: blocos,
        usuarioLogado: req.session.usuarioLogado || null
      });
    });
  });
});

/* GET /noticias/nova/criar - Formulário para criar notícia (só admin) */
router.get('/nova/criar', verificarAdmin, function(req, res) {
  res.render('nova-noticia', {
    title: 'Nova Notícia',
    noticia: null,
    blocos: [],
    usuarioLogado: req.session.usuarioLogado
  });
});

/* POST /noticias/nova/criar - Salva a notícia nova com seus blocos (só admin) */
// Espera, além de titulo/descricao/imagem_capa:
//   blocos_texto[]  -> array de textos (um por bloco, pode ser string vazia)
//   bloco_imagem_0, bloco_imagem_1, ... -> arquivo de imagem de cada bloco (campo dinâmico, opcional)
router.post('/nova/criar', verificarAdmin, upload.any(), function(req, res) {
  const { titulo, descricao } = req.body;
  const idAutor = req.session.usuarioLogado.id;

  if (!titulo || !titulo.trim()) {
    return res.render('nova-noticia', {
      title: 'Nova Notícia',
      noticia: null,
      blocos: [],
      usuarioLogado: req.session.usuarioLogado,
      erro: 'O título é obrigatório.'
    });
  }

  // Imagem de capa (a que aparece no card da home) vem do campo 'imagem_capa'
  const arquivoCapa = (req.files || []).find(f => f.fieldname === 'imagem_capa');
  const fotoCapa = arquivoCapa ? arquivoCapa.buffer : null;

  const sqlPost = `
    INSERT INTO publicacoes (titulo, descricao, id_autor, foto, data_publicacao)
    VALUES (?, ?, ?, ?, NOW())
  `;

  db.query(sqlPost, [titulo.trim(), descricao || null, idAutor, fotoCapa], (err, resultado) => {
    if (err) {
      console.error('Erro ao criar notícia:', err);
      return res.render('nova-noticia', {
        title: 'Nova Notícia',
        noticia: null,
        blocos: [],
        usuarioLogado: req.session.usuarioLogado,
        erro: 'Erro ao salvar a notícia: ' + err.message
      });
    }

    const idNoticia = resultado.insertId;
    salvarBlocos(req, idNoticia, function(errBlocos) {
      if (errBlocos) {
        console.error('Erro ao salvar blocos:', errBlocos);
        return res.send('Notícia criada, mas houve erro ao salvar o conteúdo: ' + errBlocos.message);
      }
      res.redirect('/noticias/' + idNoticia);
    });
  });
});

/* GET /noticias/:id/editar - Formulário de edição, já com os blocos existentes (só admin) */
router.get('/:id/editar', verificarAdmin, function(req, res) {
  const noticiaId = req.params.id;

  db.query('SELECT * FROM publicacoes WHERE id = ?', [noticiaId], (err, results) => {
    if (err) return res.send('Erro ao buscar notícia.');
    if (!results[0]) return res.status(404).send('Notícia não encontrada.');

    db.query('SELECT * FROM noticia_blocos WHERE id_noticia = ? ORDER BY ordem ASC', [noticiaId], (err2, blocos) => {
      if (err2) return res.send('Erro ao buscar conteúdo da notícia.');

      res.render('nova-noticia', {
        title: 'Editar Notícia',
        noticia: results[0],
        blocos: blocos,
        usuarioLogado: req.session.usuarioLogado
      });
    });
  });
});

/* POST /noticias/:id/editar - Salva a edição (substitui todos os blocos) (só admin) */
router.post('/:id/editar', verificarAdmin, upload.any(), function(req, res) {
  const noticiaId = req.params.id;
  const { titulo, descricao } = req.body;

  const arquivoCapa = (req.files || []).find(f => f.fieldname === 'imagem_capa');
  const novaFotoCapa = arquivoCapa ? arquivoCapa.buffer : null;

  let sql, params;
  if (novaFotoCapa) {
    sql = 'UPDATE publicacoes SET titulo = ?, descricao = ?, foto = ? WHERE id = ?';
    params = [titulo, descricao || null, novaFotoCapa, noticiaId];
  } else {
    sql = 'UPDATE publicacoes SET titulo = ?, descricao = ? WHERE id = ?';
    params = [titulo, descricao || null, noticiaId];
  }

  db.query(sql, params, (err) => {
    if (err) return res.status(500).send('Erro ao salvar: ' + err.message);

    // Estratégia simples: remove todos os blocos antigos e recria do zero
    // com o que veio do formulário (evita ter que calcular diffs).
    db.query('DELETE FROM noticia_blocos WHERE id_noticia = ?', [noticiaId], (err2) => {
      if (err2) return res.send('Erro ao atualizar conteúdo: ' + err2.message);

      salvarBlocos(req, noticiaId, function(errBlocos) {
        if (errBlocos) {
          console.error('Erro ao salvar blocos:', errBlocos);
          return res.send('Notícia atualizada, mas houve erro ao salvar o conteúdo: ' + errBlocos.message);
        }
        res.redirect('/noticias/' + noticiaId);
      });
    });
  });
});

/* DELETE /noticias/:id - Exclui a notícia e seus blocos (só admin) */
// Os blocos são excluídos automaticamente pela FK ON DELETE CASCADE.
router.delete('/:id', verificarAdmin, function(req, res) {
  const noticiaId = req.params.id;

  db.query('DELETE FROM publicacoes WHERE id = ?', [noticiaId], (err) => {
    if (err) return res.json({ sucesso: false, mensagem: 'Erro ao excluir.' });
    res.json({ sucesso: true });
  });
});

/* ---------- Função auxiliar: salva os blocos de uma notícia ---------- */
// Lê req.body.blocos_texto[] (HTML rico, com <strong> para negrito),
// req.body.blocos_tipo[] ('normal' ou 'subtitulo'), e os arquivos
// req.files com fieldname 'bloco_imagem_N', inserindo uma linha em
// noticia_blocos para cada bloco.
function salvarBlocos(req, idNoticia, callback) {
  let textos = req.body.blocos_texto;
  let tipos = req.body.blocos_tipo;

  if (!textos) textos = [];
  if (!Array.isArray(textos)) textos = [textos];

  if (!tipos) tipos = [];
  if (!Array.isArray(tipos)) tipos = [tipos];

  const arquivos = req.files || [];

  if (textos.length === 0) return callback(null);

  const valores = textos.map(function(texto, index) {
    const arquivoBloco = arquivos.find(f => f.fieldname === 'bloco_imagem_' + index);
    const imagemBuffer = arquivoBloco ? arquivoBloco.buffer : null;
    // texto vem como HTML (pode ter <strong>); some com espaços/tags vazias
    const textoLimpo = texto ? sanitizarHtmlBloco(texto.trim()) : '';
    const textoFinal = (textoLimpo && textoLimpo !== '<br>') ? textoLimpo : null;
    const tipoFinal = (tipos[index] === 'subtitulo') ? 'subtitulo' : 'normal';
    return [idNoticia, index, imagemBuffer, textoFinal, tipoFinal];
  })
  .filter(function(linha) {
    return linha[2] !== null || linha[3] !== null;
  });

  if (valores.length === 0) return callback(null);

  const sql = 'INSERT INTO noticia_blocos (id_noticia, ordem, imagem, texto, tipo_texto) VALUES ?';
  db.query(sql, [valores], function(err) {
    callback(err);
  });
}

module.exports = router;