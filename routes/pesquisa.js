var express = require('express');
var router = express.Router();

router.get('/resultado', (req, res) => {
    const termo = req.query.q;

    res.render('resultado', {
        title: "INFOCLUSÃO",
        busca: termo
    });
});

module.exports = router;