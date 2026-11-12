var express = require('express');
var router = express.Router();

/* GET página de ajuda. */
router.get('/', function(req, res, next) {
  res.render('ajuda', { title: 'AJUDA' });
});

module.exports = router;