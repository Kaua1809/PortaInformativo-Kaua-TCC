var express = require('express');
var router = express.Router();
const db = require('../db');
const transporter = require('../mailer');
const verificarAdmin = require('../verificarAdmin');

router.use(verificarAdmin);

/* GET - Painel: denúncias pendentes + contatos + feedbacks */
router.get('/denuncias', function(req, res) {
  const sqlDenuncias = `
    SELECT 
      d.id, d.postagem_id, d.comentario_id, d.motivo, d.data_denuncia, d.status,
      reporter.nome_exibicao as reporter_nome, reporter.login as reporter_login,
      COALESCE(pp.id_portal, c.usuario_id) as denunciado_id,
      acc.nome_exibicao as denunciado_nome, acc.login as denunciado_login,
      acc.email as denunciado_email, acc.banido as denunciado_banido, acc.suspenso_ate,
      COALESCE(pp.comentarios, c.texto_comentario) as conteudo_preview
    FROM denuncias d
    JOIN usuario reporter ON reporter.id = d.usuario_id
    LEFT JOIN postagem_pais pp ON pp.id = d.postagem_id
    LEFT JOIN comentarios c ON c.id = d.comentario_id
    LEFT JOIN usuario acc ON acc.id = COALESCE(pp.id_portal, c.usuario_id)
    WHERE d.status = 'pendente'
    ORDER BY d.data_denuncia DESC
  `;

  db.query(sqlDenuncias, (err, denuncias) => {
    if (err) { console.error(err); denuncias = []; }

    const sqlContatos = `SELECT * FROM mensagens_contato WHERE tipo = 'contato' ORDER BY id DESC LIMIT 30`;
    db.query(sqlContatos, (err2, contatos) => {
      if (err2) { console.error(err2); contatos = []; }

      const sqlFeedbacks = `SELECT * FROM mensagens_contato WHERE tipo = 'feedback' ORDER BY id DESC LIMIT 30`;
      db.query(sqlFeedbacks, (err3, feedbacks) => {
        if (err3) { console.error(err3); feedbacks = []; }

        res.render('admin-denuncias', {
          title: 'Painel de Denúncias',
          denuncias, contatos, feedbacks,
          usuarioLogado: req.session.usuarioLogado
        });
      });
    });
  });
});

// Busca o usuário denunciado E o conteúdo denunciado (texto da postagem ou comentário) de uma denúncia
function buscarDenunciaCompleta(denunciaId, callback) {
  const sql = `
    SELECT 
      d.id as denuncia_id,
      COALESCE(pp.id_portal, c.usuario_id) as denunciado_id,
      COALESCE(pp.comentarios, c.texto_comentario) as conteudo
    FROM denuncias d
    LEFT JOIN postagem_pais pp ON pp.id = d.postagem_id
    LEFT JOIN comentarios c ON c.id = d.comentario_id
    WHERE d.id = ?
  `;
  db.query(sql, [denunciaId], (err, results) => {
    if (err || !results[0] || !results[0].denunciado_id) return callback(null, null);
    callback(results[0].denunciado_id, results[0].conteudo);
  });
}

// Mesmo padrão visual do e-mail de ativação de conta (caixa com borda, título centralizado, rodapé)
function enviarEmailModeracao(email, nome, assunto, tituloInterno, corpoHtml, callback) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
        <h2 style="color: #333; text-align: center;">${tituloInterno}</h2>
        <p style="font-size: 16px; color: #555;">Olá, <strong>${nome}</strong>!</p>
        ${corpoHtml}
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #aaa; text-align: center;">&copy; 2026 Portal Informativo - TCC</p>
    </div>
  `;

  transporter.sendMail({
    from: '"Portal Informativo" <portal.informativo02@gmail.com>',
    to: email,
    subject: assunto,
    html: html
  }, (error) => {
    if (error) console.log('Erro ao enviar e-mail de moderação:', error);
    callback();
  });
}

/* POST - Suspender a conta denunciada por N dias */
router.post('/denuncias/:id/suspender', function(req, res) {
  const dias = parseInt(req.body.dias, 10);
  if (!dias || dias < 1) return res.json({ sucesso: false, mensagem: 'Informe um número de dias válido.' });

  buscarDenunciaCompleta(req.params.id, (denunciadoId) => {
    if (!denunciadoId) return res.json({ sucesso: false, mensagem: 'Não foi possível localizar o usuário denunciado.' });

    db.query('UPDATE usuario SET suspenso_ate = DATE_ADD(NOW(), INTERVAL ? DAY) WHERE id = ?', [dias, denunciadoId], (err) => {
      if (err) return res.json({ sucesso: false, mensagem: 'Erro ao suspender.' });

      db.query('UPDATE denuncias SET status = "resolvida" WHERE id = ?', [req.params.id]);

      db.query('SELECT email, login FROM usuario WHERE id = ?', [denunciadoId], (err2, results) => {
        const usuario = results && results[0];
        if (usuario) {
          enviarEmailModeracao(usuario.email, usuario.login,
            'Sua conta foi suspensa - Portal Informativo',
            'Conta Suspensa',
            `<p style="font-size: 16px; color: #555;">Sua conta foi suspensa por ${dias} dia(s) por violar as diretrizes do Portal Informativo.</p>`,
            () => res.json({ sucesso: true, mensagem: 'Usuário suspenso e notificado por e-mail.' })
          );
        } else {
          res.json({ sucesso: true, mensagem: 'Usuário suspenso.' });
        }
      });
    });
  });
});

/* POST - Banir permanentemente a conta denunciada */
router.post('/denuncias/:id/banir', function(req, res) {
  buscarDenunciaCompleta(req.params.id, (denunciadoId) => {
    if (!denunciadoId) return res.json({ sucesso: false, mensagem: 'Não foi possível localizar o usuário denunciado.' });

    db.query('UPDATE usuario SET banido = 1 WHERE id = ?', [denunciadoId], (err) => {
      if (err) return res.json({ sucesso: false, mensagem: 'Erro ao banir.' });

      db.query('UPDATE denuncias SET status = "resolvida" WHERE id = ?', [req.params.id]);

      db.query('SELECT email, login FROM usuario WHERE id = ?', [denunciadoId], (err2, results) => {
        const usuario = results && results[0];
        if (usuario) {
          enviarEmailModeracao(usuario.email, usuario.login,
            'Sua conta foi banida - Portal Informativo',
            'Conta Banida',
            `<p style="font-size: 16px; color: #555;">Sua conta foi banida permanentemente por violar as diretrizes do Portal Informativo.</p>`,
            () => res.json({ sucesso: true, mensagem: 'Usuário banido e notificado por e-mail.' })
          );
        } else {
          res.json({ sucesso: true, mensagem: 'Usuário banido.' });
        }
      });
    });
  });
});

/* POST - Enviar aviso de infração (sem punição imediata), citando a mensagem denunciada */
router.post('/denuncias/:id/avisar', function(req, res) {
  buscarDenunciaCompleta(req.params.id, (denunciadoId, conteudo) => {
    if (!denunciadoId) return res.json({ sucesso: false, mensagem: 'Não foi possível localizar o usuário denunciado.' });

    db.query('UPDATE denuncias SET status = "resolvida" WHERE id = ?', [req.params.id]);

    db.query('SELECT email, login FROM usuario WHERE id = ?', [denunciadoId], (err, results) => {
      const usuario = results && results[0];
      if (!usuario) return res.json({ sucesso: false, mensagem: 'Usuário não encontrado.' });

      const citacao = conteudo
        ? `<p style="font-size: 15px; color: #555; background: #f4f4f4; border-left: 4px solid #e74c3c; padding: 10px 14px; margin: 15px 0;">Sua mensagem <em>"${conteudo}"</em> teve aviso sobre violação de diretrizes.</p>`
        : '';

      const corpo = `
        <p style="font-size: 16px; color: #555;">Recebemos uma denúncia sobre um conteúdo seu. Após revisão, identificamos uma violação das diretrizes do Portal Informativo.</p>
        ${citacao}
        <p style="font-size: 16px; color: #555;">Este é um aviso. Tome cuidado com o conteúdo que publica — reincidências podem acarretar em <strong>suspensão temporária</strong> ou <strong>banimento permanente</strong> da sua conta.</p>
      `;

      enviarEmailModeracao(usuario.email, usuario.login,
        'Aviso de Infração - Portal Informativo',
        'Aviso de Infração',
        corpo,
        () => res.json({ sucesso: true, mensagem: 'Aviso enviado por e-mail.' })
      );
    });
  });
});

/* DELETE - Descartar denúncia (considerada falsa) */
router.delete('/denuncias/:id', function(req, res) {
  db.query('DELETE FROM denuncias WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.json({ sucesso: false, mensagem: 'Erro ao descartar denúncia.' });
    res.json({ sucesso: true, mensagem: 'Denúncia descartada.' });
  });
});

/* DELETE - Excluir uma postagem (e tudo que depende dela: comentários, curtidas, denúncias) */
router.delete('/postagem/:id', function(req, res) {
  const postagemId = req.params.id;

  db.query('DELETE FROM comentarios WHERE postagem_id = ?', [postagemId], (err) => {
    if (err) return res.json({ sucesso: false, mensagem: 'Erro ao excluir comentários da postagem.' });

    db.query('DELETE FROM curtidas WHERE postagem_id = ?', [postagemId], (err2) => {
      if (err2) return res.json({ sucesso: false, mensagem: 'Erro ao excluir curtidas da postagem.' });

      db.query('DELETE FROM denuncias WHERE postagem_id = ?', [postagemId], (err3) => {
        if (err3) return res.json({ sucesso: false, mensagem: 'Erro ao excluir denúncias da postagem.' });

        db.query('DELETE FROM postagem_pais WHERE id = ?', [postagemId], (err4) => {
          if (err4) return res.json({ sucesso: false, mensagem: 'Erro ao excluir a postagem.' });
          res.json({ sucesso: true, mensagem: 'Postagem excluída com sucesso.' });
        });
      });
    });
  });
});

/* DELETE - Excluir um comentário/resposta (e as respostas dele, se for raiz) */
router.delete('/comentario/:id', function(req, res) {
  const comentarioId = req.params.id;

  db.query('DELETE FROM comentarios WHERE comentario_pai_id = ?', [comentarioId], (err) => {
    if (err) return res.json({ sucesso: false, mensagem: 'Erro ao excluir respostas.' });

    db.query('DELETE FROM curtidas WHERE comentario_id = ?', [comentarioId], (err2) => {
      if (err2) return res.json({ sucesso: false, mensagem: 'Erro ao excluir curtidas do comentário.' });

      db.query('DELETE FROM denuncias WHERE comentario_id = ?', [comentarioId], (err3) => {
        if (err3) return res.json({ sucesso: false, mensagem: 'Erro ao excluir denúncias do comentário.' });

        db.query('DELETE FROM comentarios WHERE id = ?', [comentarioId], (err4) => {
          if (err4) return res.json({ sucesso: false, mensagem: 'Erro ao excluir o comentário.' });
          res.json({ sucesso: true, mensagem: 'Comentário excluído com sucesso.' });
        });
      });
    });
  });
});

/* DELETE - Remover mensagem de contato/feedback já tratada */
router.delete('/mensagens/:id', function(req, res) {
  db.query('DELETE FROM mensagens_contato WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.json({ sucesso: false });
    res.json({ sucesso: true });
  });
});

module.exports = router;