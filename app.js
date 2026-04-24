var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

const db = require('./db');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var deficienciasRouter = require('./routes/deficiencias');
var responsavelRouter = require('./routes/responsavel');
var pesquisaRouter = require('./routes/pesquisa');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ROTAS
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/deficiencias', deficienciasRouter);
app.use('/responsavel', responsavelRouter);
app.use('/pesquisa', pesquisaRouter);

// 404
app.use(function(req, res, next) {
  next(createError(404));
});

// erro
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;