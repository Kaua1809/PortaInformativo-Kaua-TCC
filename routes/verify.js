const express = require('express');
const router = express.Router();
const db = require('../db');

// Rota que o usuário acessa ao clicar no link do e-mail
router.get('/', (req, res) => {
    const email = req.query.email;

    if (!email) return res.send('Link inválido');

    // ATUALIZA O STATUS NO BANCO PARA TRUE
    const sql = 'UPDATE Usuario SET is_verified = true WHERE email = ?';

    db.query(sql, [email], (err, result) => {
        if (err) return res.send('Erro ao verificar');
        
        // Redireciona para o login com aviso de sucesso
        res.redirect('/login?verificado=true');
    });
});

module.exports = router;