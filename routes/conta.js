var express = require('express');
var router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // ADICIONADO: Para deletar arquivos

// 1. Configuração do Multer para Upload de Fotos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/'); 
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, 'perfil-' + req.session.usuarioLogado.id + '-' + uniqueSuffix);
  }
});
const upload = multer({ storage: storage });

// 2. Rota de visualização (GET /conta)
router.get('/', function(req, res) {
  if (!req.session.usuarioLogado) return res.redirect('/login');
  
  const sql = 'SELECT * FROM Usuario WHERE id = ?';
  db.query(sql, [req.session.usuarioLogado.id], (err, results) => {
    if (err) return res.send('Erro ao buscar dados');
    res.render('conta', { 
      usuario: results[0], 
      editMode: false, 
      title: 'Minha Conta' 
    });
  });
});

// 3. Rota para abrir o formulário de edição (GET /conta/editar)
router.get('/editar', function(req, res) {
  if (!req.session.usuarioLogado) return res.redirect('/login');
  
  const sql = 'SELECT * FROM Usuario WHERE id = ?';
  db.query(sql, [req.session.usuarioLogado.id], (err, results) => {
    if (err) return res.send('Erro ao buscar dados');
    res.render('conta', { 
      usuario: results[0], 
      editMode: true, 
      title: 'Editar Perfil'
    });
  });
});

// 4. Rota para salvar as alterações (POST /conta/editar)
router.post('/editar', upload.single('foto_perfil'), function(req, res) {
  if (!req.session.usuarioLogado) return res.redirect('/login'); // Segurança extra
  
  const userId = req.session.usuarioLogado.id;
  const { login, bio } = req.body;
  
  // BUSCA A FOTO ANTIGA NO BANCO ANTES DE ATUALIZAR
  const sqlBuscaAntiga = "SELECT foto_perfil FROM Usuario WHERE id = ?";
  
  db.query(sqlBuscaAntiga, [userId], (err, results) => {
    if (err) {
      console.log(err);
      return res.send("Erro ao buscar foto antiga");
    }
    
    const fotoAntiga = results[0] ? results[0].foto_perfil : null;
    let sql, params;
    
    if (req.file) {
      // Se enviou foto nova
      const fotoCaminho = '/uploads/' + req.file.filename;
      sql = "UPDATE Usuario SET login = ?, bio = ?, foto_perfil = ? WHERE id = ?";
      params = [login, bio, fotoCaminho, userId];

      // LÓGICA PARA EXCLUIR A FOTO ANTIGA DA PASTA UPLOADS
      if (fotoAntiga && fotoAntiga !== '/img/default-avatar.png') { 
        // path.join ajuda a achar o caminho real da pasta no seu computador
        const caminhoCompletoAntigo = path.join(__dirname, '../public', fotoAntiga);
        
        fs.unlink(caminhoCompletoAntigo, (err) => {
          if (err) {
            console.log("Aviso: Não foi possível deletar a foto antiga:", err.message);
          } else {
            console.log("Sucesso: Foto antiga excluída da pasta uploads");
          }
        });
      }
    } else {
      // Se não enviou foto nova, mantém a antiga
      sql = "UPDATE Usuario SET login = ?, bio = ? WHERE id = ?";
      params = [login, bio, userId];
    }

    // AGORA SIM, SALVA OS NOVOS DADOS NO BANCO
    db.query(sql, params, (err, result) => {
      if (err) {
          console.log(err);
          return res.send("Erro ao salvar no banco: " + err.message);
      }

      // ATUALIZA A SESSÃO PARA O MENU MUDAR NA HORA
      req.session.usuarioLogado.login = login;
      req.session.usuarioLogado.bio = bio;
      if (req.file) {
          req.session.usuarioLogado.foto_perfil = '/uploads/' + req.file.filename;
      }
      
      res.redirect("/conta");
    });
  });
});

module.exports = router;