var express = require('express');
var router = express.Router();
const db = require('../db');
const multer = require('multer');
const sanitizeHtml = require('sanitize-html'); // npm install sanitize-html
const verificarAdmin = require('../verificarAdmin');

// IMPORTANTE: para o middleware verificarAdmin funcionar, a rota de LOGIN
// precisa salvar 'is_admin' dentro de req.session.usuarioLogado, por exemplo:
//   req.session.usuarioLogado = { id: usuario.id, login: usuario.login, is_admin: usuario.is_admin, ... };

// =====================================================================
// SANITIZAÇÃO DO HTML DO EDITOR RICO
// Usa a biblioteca sanitize-html (precisa instalar: npm install sanitize-html)
// em vez de regex manual, porque sanitizar HTML com atributos (style, href,
// target) de forma segura via regex é frágil e fácil de furar.
// Permite: negrito, itálico, sublinhado, tachado, cor de texto, marca-texto,
// tamanho/família de fonte (via classes pré-definidas, não CSS livre),
// alinhamento, listas (com marcador, numerada, de tarefas) e links.
// =====================================================================
const OPCOES_SANITIZACAO = {
  allowedTags: [
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'br', 'span', 'p',
    'ul', 'ol', 'li', 'a'
  ],
  allowedAttributes: {
    // 'class' é usada para cor/marca-texto/fonte/tamanho/alinhamento, todos
    // vindos de uma paleta fixa pré-definida no front (ver TOOLBAR_CLASSES
    // no nova-noticia.ejs) -- nunca aceitamos 'style' livre, o que evitaria
    // qualquer CSS arbitrário sendo injetado.
    span: ['class'],
    p: ['class'],
    li: ['class'],
    a: ['href', 'target', 'rel']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  // Força rel="noopener noreferrer" em links que abrem em nova aba,
  // prevenindo o ataque de "reverse tabnabbing".
  transformTags: {
    'a': function (tagName, attribs) {
      if (attribs.target === '_blank') {
        attribs.rel = 'noopener noreferrer';
      }
      return { tagName: 'a', attribs: attribs };
    }
  }
};

function sanitizarHtmlBloco(html) {
  if (!html) return html;
  return sanitizeHtml(html, OPCOES_SANITIZACAO);
}

// Sanitização mais restrita para o autor da citação (texto puro, sem tags)
function sanitizarTextoSimples(texto) {
  if (!texto) return texto;
  return sanitizeHtml(texto, { allowedTags: [], allowedAttributes: {} });
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

      // Carregar imagens das galerias
      const idsGaleria = blocos.filter(b => b.tipo_texto === 'galeria').map(b => b.id);
      if (idsGaleria.length === 0) {
        return res.render('noticia', {
          title: results[0].titulo, noticia: results[0], blocos: blocos, usuarioLogado: req.session.usuarioLogado || null
        });
      }
      db.query('SELECT * FROM noticia_galeria_imagens WHERE id_bloco IN (?) ORDER BY id_bloco, ordem ASC', [idsGaleria], (err3, imgGaleria) => {
        if (err3) return res.send('Erro ao buscar imagens da galeria.');
        blocos.forEach(function(bloco) {
          if (bloco.tipo_texto === 'galeria') {
            bloco.galeriaImagens = imgGaleria.filter(img => img.id_bloco === bloco.id);
          }
        });
        res.render('noticia', {
          title: results[0].titulo, noticia: results[0], blocos: blocos, usuarioLogado: req.session.usuarioLogado || null
        });
      });
    });
  });
});

/* GET /noticias/:id/foto - Serve a imagem de capa da notícia */
router.get('/:id/foto', function(req, res) {
  db.query('SELECT foto FROM publicacoes WHERE id = ?', [req.params.id], (err, results) => {
    if (err || !results[0] || !results[0].foto) {
      return res.status(404).send('Foto não encontrada.');
    }
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(results[0].foto);
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

      const idsGaleria = blocos.filter(b => b.tipo_texto === 'galeria').map(b => b.id);
      if (idsGaleria.length === 0) {
        return res.render('nova-noticia', {
          title: 'Editar Notícia', noticia: results[0], blocos: blocos, usuarioLogado: req.session.usuarioLogado
        });
      }
      db.query('SELECT * FROM noticia_galeria_imagens WHERE id_bloco IN (?) ORDER BY id_bloco, ordem ASC', [idsGaleria], (err3, imgGaleria) => {
        if (err3) return res.send('Erro ao buscar imagens da galeria.');
        blocos.forEach(function(bloco) {
          if (bloco.tipo_texto === 'galeria') {
            bloco.galeriaImagens = imgGaleria.filter(img => img.id_bloco === bloco.id);
          }
        });
        res.render('nova-noticia', {
          title: 'Editar Notícia', noticia: results[0], blocos: blocos, usuarioLogado: req.session.usuarioLogado
        });
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
router.delete('/:id', verificarAdmin, function(req, res) {
  const noticiaId = req.params.id;

  db.query('DELETE FROM publicacoes WHERE id = ?', [noticiaId], (err) => {
    if (err) return res.json({ sucesso: false, mensagem: 'Erro ao excluir.' });
    res.json({ sucesso: true });
  });
});

/* ---------- Função auxiliar: salva os blocos de uma notícia ---------- */
// Tipos de bloco suportados (req.body.blocos_tipo[]):
//   'normal'     -> texto rico (negrito, itálico, listas, links, etc.)
//   'subtitulo'  -> intertítulo em destaque
//   'citacao'    -> bloco de citação (texto + autor opcional)
//   'separador'  -> divisor visual (sem texto, sem imagem, sem autor)
function salvarBlocos(req, idNoticia, callback) {
  let textos = normalizarParaArray(req.body.blocos_texto);
  let tipos = normalizarParaArray(req.body.blocos_tipo);
  let autoresCitacao = normalizarParaArray(req.body.blocos_citacao_autor);
  let imagensAlt = normalizarParaArray(req.body.blocos_imagem_alt);
  let imagensFonte = normalizarParaArray(req.body.blocos_imagem_fonte);
  let imagensTamanho = normalizarParaArray(req.body.blocos_imagem_tamanho);
  let imagensOrientacao = normalizarParaArray(req.body.blocos_imagem_orientacao);

  const arquivos = req.files || [];

  if (textos.length === 0 && tipos.length === 0) return callback(null);

  const totalBlocos = Math.max(textos.length, tipos.length);
  const valores = [];

  for (let index = 0; index < totalBlocos; index++) {
    const tipoFinal = tipos[index] || 'normal';
    const arquivoBloco = arquivos.find(f => f.fieldname === 'bloco_imagem_' + index);
    let imagemBuffer = null;
    if (arquivoBloco) {
      imagemBuffer = arquivoBloco.buffer;
    } else {
      const base64Existente = (req.body['bloco_imagem_existente_' + index] || '').replace(/^data:image\/\w+;base64,/, '');
      if (base64Existente) {
        try { imagemBuffer = Buffer.from(base64Existente, 'base64'); } catch(e) {}
      }
    }

    let textoFinal = null;
    if (tipoFinal !== 'separador') {
      const textoBruto = textos[index] ? textos[index].trim() : '';
      const textoLimpo = textoBruto ? sanitizarHtmlBloco(textoBruto) : '';
      textoFinal = (textoLimpo && textoLimpo !== '<br>' && textoLimpo !== '<p></p>') ? textoLimpo : null;
    }

    let autorFinal = null;
    if (tipoFinal === 'citacao' && autoresCitacao[index]) {
      autorFinal = sanitizarTextoSimples(autoresCitacao[index].trim()) || null;
    }

    const altFinal = sanitizarTextoSimples((imagensAlt[index] || '').trim()) || null;
    const fonteFinal = sanitizarTextoSimples((imagensFonte[index] || '').trim()) || null;
    const tamanhoFinal = ['pequena', 'media', 'grande', 'gigante'].includes(imagensTamanho[index]) ? imagensTamanho[index] : 'grande';
    const orientacaoFinal = ['horizontal', 'vertical'].includes(imagensOrientacao[index]) ? imagensOrientacao[index] : 'horizontal';

    // Galeria: montar JSON com metadados + imagens coletadas dos campos hidden
    let galeriaJsonFinal = null;
    if (tipoFinal === 'galeria') {
      let galMeta = { cols: '3', altura: 'media', imagens: [] };
      try { if (textoFinal) galMeta = JSON.parse(textoFinal); } catch(e) {}
      // Coletar imagens: galeria_img_{index}_0, galeria_img_{index}_1, ...
      const imgBuffers = [];
      let i = 0;
      while (req.body['galeria_img_' + index + '_' + i]) {
        const base64 = req.body['galeria_img_' + index + '_' + i].replace(/^data:image\/\w+;base64,/, '');
        imgBuffers.push(Buffer.from(base64, 'base64'));
        i++;
      }
      galMeta.totalImagens = imgBuffers.length;
      galeriaJsonFinal = JSON.stringify(galMeta);
      // Imagens da galeria serão inseridas em noticia_galeria_imagens após o bloco
      valores.push([idNoticia, index, null, galeriaJsonFinal, tipoFinal, null, null, null, null, null, imgBuffers]);
      continue;
    }

    const blocoTemConteudo = tipoFinal === 'separador' || imagemBuffer !== null || textoFinal !== null;
    if (!blocoTemConteudo) continue;

    valores.push([idNoticia, index, imagemBuffer, textoFinal, tipoFinal, autorFinal, altFinal, fonteFinal, tamanhoFinal, orientacaoFinal, null]);
  }

  if (valores.length === 0) return callback(null);

  // Separa blocos normais de galerias
  const valoresNormais = valores.filter(function(v) { return v[4] !== 'galeria'; }).map(function(v) { return v.slice(0,10); });
  const valoresGaleria = valores.filter(function(v) { return v[4] === 'galeria'; });

  function inserirGalerias(idsBlocos, galerias, cb) {
    if (galerias.length === 0) return cb(null);
    const galeria = galerias[0];
    const idBloco = idsBlocos.shift();
    if (!idBloco || !galeria[10] || galeria[10].length === 0) return inserirGalerias(idsBlocos, galerias.slice(1), cb);
    const imgValores = galeria[10].map(function(buf, i) { return [idBloco, i, buf]; });
    db.query('INSERT INTO noticia_galeria_imagens (id_bloco, ordem, imagem) VALUES ?', [imgValores], function(err) {
      if (err) return cb(err);
      inserirGalerias(idsBlocos, galerias.slice(1), cb);
    });
  }

  const sql = 'INSERT INTO noticia_blocos (id_noticia, ordem, imagem, texto, tipo_texto, citacao_autor, imagem_alt, imagem_fonte, imagem_tamanho, imagem_orientacao) VALUES ?';

  // Inserir todos os blocos normais + galerias juntos para preservar a ordem
  const todosValores = valores.map(function(v) { return v.slice(0,10); });
  db.query(sql, [todosValores], function(err, resultado) {
    if (err) return callback(err);
    // Buscar IDs inseridos para associar às imagens das galerias
    const primeiroId = resultado.insertId;
    const idsInseridos = todosValores.map(function(_, i) { return primeiroId + i; });
    const idsGaleria = [];
    valores.forEach(function(v, i) { if (v[4] === 'galeria') idsGaleria.push(idsInseridos[i]); });
    inserirGalerias(idsGaleria, valoresGaleria, callback);
  });
}

// Garante que um campo de formulário sempre vire array, mesmo que só tenha
// vindo 1 bloco (nesse caso o Express entrega como string única, não array).
function normalizarParaArray(campo) {
  if (!campo) return [];
  return Array.isArray(campo) ? campo : [campo];
}

module.exports = router;