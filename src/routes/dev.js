const express = require('express');
const dev = require('../controllers/devController');

// Only mounted when config.mail.devMailbox is on, which is never the case
// with NODE_ENV=production.
const router = express.Router();

router.get('/mailbox', dev.mailbox);
router.get('/mailbox/:id', dev.showMessage);
router.get('/mailbox/:id/raw', dev.rawMessage);
router.post('/mailbox/clear', dev.clear);

module.exports = router;
