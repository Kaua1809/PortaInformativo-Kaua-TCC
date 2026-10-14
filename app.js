var createError = require('http-errors' );
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');

// 1. INICIALIZA O APP (Deve ser logo no início)
var app = express();

// 2. IMPORTA O BANCO DE DADOS
const db = require('./db');

// 3. CONFIGURAÇÃO DA SESSÃO (Deve vir ANTES de usar req.session)
app.use(session({
  secret: 'seu_segredo_aqui',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 }
}));

// 4. MIDDLEWARE PARA PASSAR USUARIO PARA AS VIEWS
app.use((req, res, next) => {
    res.locals.usuarioLogado = req.session.usuarioLogado || null;
    next();
});

// 5. CONFIGURAÇÃO DO VIEW ENGINE (EJS)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.locals.FOTO_PADRAO = '/images/semfoto.png';

// 6. IMPORTAÇÃO E DEFINIÇÃO DAS ROTAS
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var mielomeningoceleRouter = require('./routes/mielomeningocele');
var hidrocefaliaRouter = require('./routes/hidrocefalia');
var responsavelRouter = require('./routes/responsavel');
var pesquisaRouter = require('./routes/pesquisa');
var legislacaoRouter = require('./routes/legislacao');
var loginRouter = require('./routes/login');
var cadastroRouter = require('./routes/cadastro');
var contaRouter = require('./routes/conta');
var redefinirSenhaRouter = require('./routes/redefinir-senha'); // Rota pública do link de redefinição de senha
var verifyRouter = require('./routes/verify'); // Importe a nova rota de verificação
const contatoRouter = require('./routes/contato'); // ajuste o caminho conforme sua estrutura
var noticiasRouter = require('./routes/noticias');
var acessibilidadeRouter = require('./routes/acessibilidade');
var adminRouter = require('./routes/admin');

app.use('/admin', require('./routes/admin'));
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/mielomeningocele', mielomeningoceleRouter);
app.use('/hidrocefalia', hidrocefaliaRouter);
app.use('/responsavel', responsavelRouter);
app.use('/pesquisa', pesquisaRouter);
app.use('/legislacao', legislacaoRouter);
app.use('/login', loginRouter);
app.use('/cadastro', cadastroRouter);
app.use('/conta', contaRouter);
app.use('/redefinir-senha', redefinirSenhaRouter); // Fica fora de /conta: o usuário ainda não está logado ao clicar no link do e-mail
app.use('/', contatoRouter);
app.use('/verify', verifyRouter); // Use a rota de verificação
app.use('/noticias', noticiasRouter);
app.use('/acessibilidade', acessibilidadeRouter);

// 7. TRATAMENTO DE ERROS
app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;