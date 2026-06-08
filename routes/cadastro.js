const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const transporter = require('../mailer');

// ROTA PARA MOSTRAR A PÁGINA (GET /cadastro)
router.get('/', (req, res) => {
    res.render('cadastro', { erro: null });
});

// ROTA PARA RECEBER OS DADOS (POST /cadastro)
router.post('/', async (req, res) => {
    const { login, email, senha } = req.body;
    
    try {
        const hashedSenha = await bcrypt.hash(senha, 10);

        const sql = 'INSERT INTO Usuario (login, email, senha, is_verified) VALUES (?, ?, ?, false)';
        
        db.query(sql, [login, email, hashedSenha], (err, result) => {
            if (err) {
                console.log(err);
                return res.render('cadastro', { erro: 'Erro ao cadastrar. Tente outro usuário ou e-mail.' });
            }

                        const mailOptions = {
                from: '"Portal Informativo" <Portal.Informativo02@gmail.com>',
                to: email,
                subject: 'Ativação de Conta - Portal Informativo',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
                        <h2 style="color: #333; text-align: center;">Bem-vindo ao Portal Informativo!</h2>
                        <p style="font-size: 16px; color: #555;">Olá, <strong>${login}</strong>!</p>
                        <p style="font-size: 16px; color: #555;">Obrigado por se cadastrar no nosso portal. Para garantir a segurança da sua conta, precisamos que você confirme seu endereço de e-mail.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="http://localhost:3000/verify?email=${email}" 
                               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                               Confirmar meu E-mail
                            </a>
                        </div>
                        <p style="font-size: 14px; color: #888; text-align: center;">Se você não criou esta conta, pode ignorar este e-mail com segurança.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #aaa; text-align: center;">&copy; 2026 Portal Informativo - TCC</p>
                    </div>
                `
            };


            transporter.sendMail(mailOptions, (error, info ) => {
                if (error) {
                    console.log('Erro e-mail:', error);
                    return res.render('login', { erro: 'Cadastro feito, mas houve um erro ao enviar o e-mail.', sucesso: null });
                }
                
                  transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('Erro e-mail:', error);
                    return res.render('cadastro', { erro: 'Erro ao enviar e-mail de validação.' });
                }
                
                // RECARREGA A PÁGINA DE CADASTRO COM A MENSAGEM DE SUCESSO
                res.render('cadastro', { 
                    erro: null, 
                    sucesso: 'Enviamos um e-mail de validação! Por favor, verifique sua caixa de entrada para ativar sua conta.' 
                });
            });      
            });
        });
    } catch (e) {
        res.render('cadastro', { erro: 'Erro interno no servidor.' });
    }
});

module.exports = router;
