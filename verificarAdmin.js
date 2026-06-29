// Middleware: só deixa passar se o usuário logado for administrador
function verificarAdmin(req, res, next) {
  if (!req.session.usuarioLogado) {
    return res.redirect('/login');
  }
  if (!req.session.usuarioLogado.is_admin) {
    return res.status(403).send('Acesso restrito a administradores.');
  }
  next();
}

module.exports = verificarAdmin;
