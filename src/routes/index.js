const express = require('express');
const config = require('../config');

const router = express.Router();

router.get('/', (req, res) => res.redirect(req.user ? '/dashboard' : '/login'));
router.get('/terms', (req, res) => res.render('pages/terms'));

router.use(require('./auth'));
router.use(require('./account'));
router.use('/admin', require('./admin'));

if (config.mail.devMailbox) {
  router.use('/dev', require('./dev'));
}

module.exports = router;
