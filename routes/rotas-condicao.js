// Exemplo de rota usando mysql2 (pool com promise).
// Ajuste o nome do pool/import e o middleware de usuarioLogado conforme
// o restante do seu projeto (deve ser igual ao usado na rota da home).

const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // ajuste para o caminho real do seu pool mysql2

// GET /hidrocefalia
router.get('/hidrocefalia', async (req, res) => {
    try {
        // ORDER BY RAND() embaralha as linhas a cada execução da query,
        // então a cada nova requisição (F5 / reentrada na página) o
        // resultado muda.
        const [noticiasRelacionadas] = await pool.query(
            'SELECT id, titulo, descricao, foto FROM noticias ORDER BY RAND() LIMIT 3'
        );

        res.render('hidrocefalia', {
            noticiasRelacionadas,
            usuarioLogado: req.usuarioLogado // mantenha igual ao que já usa nas outras rotas
        });
    } catch (err) {
        console.error('Erro ao buscar notícias relacionadas (hidrocefalia):', err);
        res.render('hidrocefalia', {
            noticiasRelacionadas: [],
            usuarioLogado: req.usuarioLogado
        });
    }
});

// GET /mielomeningocele
router.get('/mielomeningocele', async (req, res) => {
    try {
        const [noticiasRelacionadas] = await pool.query(
            'SELECT id, titulo, descricao, foto FROM noticias ORDER BY RAND() LIMIT 3'
        );

        res.render('mielomeningocele', {
            noticiasRelacionadas,
            usuarioLogado: req.usuarioLogado
        });
    } catch (err) {
        console.error('Erro ao buscar notícias relacionadas (mielomeningocele):', err);
        res.render('mielomeningocele', {
            noticiasRelacionadas: [],
            usuarioLogado: req.usuarioLogado
        });
    }
});

module.exports = router;
