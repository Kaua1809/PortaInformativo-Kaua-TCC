var createError = require('http-errors' );
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session'); // Módulo para sessões

// Importando a conexão do banco de dados (apenas uma vez!)
const db = require('./db');

// Importando os arquivos de rotas
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var deficienciasRouter = require('./routes/deficiencias');
var responsavelRouter = require('./routes/responsavel');
var pesquisaRouter = require('./routes/pesquisa');
var legislacaoRouter = require('./routes/legislacao');
var loginRouter = require('./routes/login');
var cadastroRouter = require('./routes/cadastro');
var contaRouter = require('./routes/conta');

var app = express();

// Configuração da sessão (deve vir antes das rotas)
app.use(session({
  secret: 'seu_segredo_aqui', // Pode ser qualquer texto
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 } // Sessão dura 1 hora
}));

// Configuração do view engine (EJS)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// DEFINIÇÃO DAS ROTAS
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/deficiencias', deficienciasRouter);
app.use('/responsavel', responsavelRouter);
app.use('/pesquisa', pesquisaRouter);
app.use('/legislacao', legislacaoRouter);
app.use('/login', loginRouter);
app.use('/cadastro', cadastroRouter);
app.use('/conta', contaRouter);

// Tratamento de erro 404 (Página não encontrada)
app.use(function(req, res, next) {
  next(createError(404));
});

// Tratamento de erros gerais
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
