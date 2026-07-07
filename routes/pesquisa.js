var express = require('express');
var router = express.Router();
const db = require('../db');

// Função simples de similaridade: retorna true se termo2 contém pelo menos
// 60% dos caracteres sequenciais de termo1 (busca fuzzy básica via LIKE fragmentado)
// No MySQL usamos SOUNDEX + LIKE com partes do termo para resultados relacionados.

router.get('/resultado', (req, res) => {
    const termo = (req.query.q || '').trim();

    if (!termo) {
        return res.render('resultado', {
            title: 'Pesquisa',
            busca: '',
            resultados: [],
            relacionados: [],
            usuarioLogado: req.session.usuarioLogado || null
        });
    }

    // Fragmentos do termo para busca fuzzy (cada palavra vira um LIKE)
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
            return res.render('resultado', {
                title: 'Pesquisa',
                busca: termo,
                resultados: [],
                relacionados: [],
                usuarioLogado: req.session.usuarioLogado || null
            });
        }

        const idsJaEncontrados = resultados.map(r => r.id);

        // ── Busca relacionada: SOUNDEX (soa parecido) ou fragmentos de palavras ──
        // Monta condições para cada palavra do termo
        let condicoesFuzzy = [];
        let paramsFuzzy = [];

        palavras.forEach(palavra => {
            // SOUNDEX: captura palavras que soam parecido (ex: "batismo" ~ "autismo")
            condicoesFuzzy.push('SOUNDEX(p.titulo) = SOUNDEX(?)');
            paramsFuzzy.push(palavra);

            // LIKE com fragmento de 3+ letras dentro do título
            if (palavra.length >= 3) {
                condicoesFuzzy.push('p.titulo LIKE ?');
                paramsFuzzy.push('%' + palavra + '%');
                condicoesFuzzy.push('p.descricao LIKE ?');
                paramsFuzzy.push('%' + palavra + '%');
            }
        });

        // Adicionar busca por blocos de texto da notícia
        if (palavras.length > 0) {
            condicoesFuzzy.push(`p.id IN (
                SELECT DISTINCT nb.id_noticia FROM noticia_blocos nb
                WHERE ${palavras.map(() => 'nb.texto LIKE ?').join(' OR ')}
            )`);
            palavras.forEach(p => paramsFuzzy.push('%' + p + '%'));
        }

        if (condicoesFuzzy.length === 0) {
            return res.render('resultado', {
                title: 'Pesquisa',
                busca: termo,
                resultados,
                relacionados: [],
                usuarioLogado: req.session.usuarioLogado || null
            });
        }

        // Exclui os já encontrados na busca exata
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

            res.render('resultado', {
                title: 'Pesquisa',
                busca: termo,
                resultados,
                relacionados,
                usuarioLogado: req.session.usuarioLogado || null
            });
        });
    });
});

module.exports = router;