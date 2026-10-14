var express = require('express');
var router = express.Router();
const db = require('../db');

router.get('/resultado', (req, res) => {
    const termo = (req.query.q || '').trim();

    if (!termo) {
        return res.render('resultado', {
            title: 'Pesquisa',
            busca: '',
            resultados: [],
            relacionados: [],
            usuarios: [],
            usuarioLogado: req.session.usuarioLogado || null
        });
    }

    const palavras = termo.split(/\s+/).filter(p => p.length >= 2);
    const termoBusca = '%' + termo + '%';

    // ── Busca exata/parcial: título ou descrição contém o termo ──────────────
    const sqlExatos = `
        SELECT p.id, p.titulo, p.descricao, p.data_publicacao,
               p.foto IS NOT NULL AS tem_foto,
               u.login AS autor_login
        FROM publicacoes p
        LEFT JOIN usuario u ON p.id_autor = u.id
        WHERE p.titulo LIKE ? OR p.descricao LIKE ?
        ORDER BY
            (p.titulo LIKE ?) DESC,
            p.data_publicacao DESC
        LIMIT 20
    `;

    db.query(sqlExatos, [termoBusca, termoBusca, termoBusca], (err, resultados) => {
        if (err) {
            console.error('Erro na busca:', err);
            resultados = [];
        }

        const idsJaEncontrados = resultados.map(r => r.id);

        // ── Busca relacionada: SOUNDEX (soa parecido) ou fragmentos de palavras ──
        let condicoesFuzzy = [];
        let paramsFuzzy = [];

        palavras.forEach(palavra => {
            condicoesFuzzy.push('SOUNDEX(p.titulo) = SOUNDEX(?)');
            paramsFuzzy.push(palavra);

            if (palavra.length >= 3) {
                condicoesFuzzy.push('p.titulo LIKE ?');
                paramsFuzzy.push('%' + palavra + '%');
                condicoesFuzzy.push('p.descricao LIKE ?');
                paramsFuzzy.push('%' + palavra + '%');
            }
        });

        if (palavras.length > 0) {
            condicoesFuzzy.push(`p.id IN (
                SELECT DISTINCT nb.id_noticia FROM noticia_blocos nb
                WHERE ${palavras.map(() => 'nb.texto LIKE ?').join(' OR ')}
            )`);
            palavras.forEach(p => paramsFuzzy.push('%' + p + '%'));
        }

        const continuarComUsuarios = (relacionados) => {
            // ── Busca de usuários (login OU nome de exibição contém o termo) ──
            const sqlUsuarios = `
                SELECT id, login, nome_exibicao, foto_perfil, bio
                FROM usuario
                WHERE login LIKE ? OR nome_exibicao LIKE ?
                ORDER BY
                    (nome_exibicao LIKE ?) DESC,
                    nome_exibicao ASC
                LIMIT 20
            `;

            db.query(sqlUsuarios, [termoBusca, termoBusca, termoBusca], (errUsuarios, usuarios) => {
                if (errUsuarios) {
                    console.error('Erro na busca de usuários:', errUsuarios);
                    usuarios = [];
                }

                res.render('resultado', {
                    title: 'Pesquisa',
                    busca: termo,
                    resultados,
                    relacionados,
                    usuarios,
                    usuarioLogado: req.session.usuarioLogado || null
                });
            });
        };

        if (condicoesFuzzy.length === 0) {
            return continuarComUsuarios([]);
        }

        const exclusao = idsJaEncontrados.length > 0
            ? `AND p.id NOT IN (${idsJaEncontrados.map(() => '?').join(',')})`
            : '';

        const sqlRelacionados = `
            SELECT DISTINCT p.id, p.titulo, p.descricao, p.data_publicacao,
                   p.foto IS NOT NULL AS tem_foto,
                   u.login AS autor_login
            FROM publicacoes p
            LEFT JOIN usuario u ON p.id_autor = u.id
            WHERE (${condicoesFuzzy.join(' OR ')})
            ${exclusao}
            ORDER BY p.data_publicacao DESC
            LIMIT 10
        `;

        const paramsRelacionados = [...paramsFuzzy, ...idsJaEncontrados];

        db.query(sqlRelacionados, paramsRelacionados, (err2, relacionados) => {
            if (err2) {
                console.error('Erro na busca relacionada:', err2);
                relacionados = [];
            }
            continuarComUsuarios(relacionados);
        });
    });
});

module.exports = router;