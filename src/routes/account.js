const express = require('express');
const account = require('../controllers/accountController');
const rules = require('../validators/account');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', requireAuth, account.dashboard);
router.get('/account', requireAuth, account.showSettings);
router.post(
  '/account/profile',
  requireAuth,
  rules.profile,
  validate('account/settings'),
  account.updateProfile
);
router.post(
  '/account/password',
  requireAuth,
  rules.changePassword,
  validate('account/settings', account.settingsLocals),
  account.changePassword
);
router.post(
  '/account/delete',
  requireAuth,
  rules.deleteAccount,
  validate('account/settings', account.settingsLocals),
  account.deleteAccount
);

module.exports = router;
