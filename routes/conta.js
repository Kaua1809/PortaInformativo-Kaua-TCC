var express = require('express');
var router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');

// 1. Configuração do Multer para Upload de Fotos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/'); // Certifique-se que esta pasta existe!
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
    
    // PASSANDO TODAS AS VARIÁVEIS NECESSÁRIAS
    res.render('conta', { 
      usuario: results[0], 
      editMode: false, // Aqui é false para apenas visualizar
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
    
    // PASSANDO TODAS AS VARIÁVEIS NECESSÁRIAS
    res.render('conta', { 
      usuario: results[0], 
      editMode: true, // Aqui é true para abrir os inputs de edição
      title: 'Editar Perfil'
    });
  });
});

// 4. Rota para salvar as alterações (POST /conta/editar)
router.post('/editar', upload.single('foto_perfil'), function(req, res) {
  const userId = req.session.usuarioLogado.id;
  const { login, bio } = req.body;
  
  let sql, params;
  
  if (req.file) {
    // Se enviou foto nova, atualiza tudo
    const fotoCaminho = '/uploads/' + req.file.filename;
    sql = "UPDATE Usuario SET login = ?, bio = ?, foto_perfil = ? WHERE id = ?";
    params = [login, bio, fotoCaminho, userId];
  } else {
    // Se não enviou foto, atualiza só texto
    sql = "UPDATE Usuario SET login = ?, bio = ? WHERE id = ?";
    params = [login, bio, userId];
  }

  db.query(sql, params, (err, result) => {
    if (err) return res.send("Erro ao salvar no banco");
    req.session.usuarioLogado.login = login;
    res.redirect("/conta");
  });
});

module.exports = router;
