const express = require('express');
const auth = require('../controllers/authController');
const password = require('../controllers/passwordController');
const rules = require('../validators/auth');
const { validate } = require('../middleware/validate');
const { requireGuest } = require('../middleware/auth');
const { loginLimiter, resendLimiter, forgotLimiter } = require('../middleware/rateLimits');

const router = express.Router();

router.get('/register', requireGuest, auth.showRegister);
router.post('/register', requireGuest, rules.register, validate('auth/register'), auth.register);

router.get('/verify-email/sent', auth.showVerificationSent);
router.get('/verify-email/resend', auth.showResend);
router.post(
  '/verify-email/resend',
  resendLimiter,
  rules.emailOnly,
  validate('auth/resend-verification'),
  auth.resendVerification
);
router.get('/verify-email/:token', auth.verifyEmail);

router.get('/login', requireGuest, auth.showLogin);
router.post('/login', requireGuest, loginLimiter, rules.login, validate('auth/login'), auth.login);
router.post('/logout', auth.logout);

router.get('/forgot-password', password.showForgot);
router.post(
  '/forgot-password',
  forgotLimiter,
  rules.emailOnly,
  validate('auth/forgot-password'),
  password.forgot
);

router.get('/reset-password/:token', password.loadResetToken, password.showReset);
router.post(
  '/reset-password/:token',
  password.loadResetToken,
  rules.resetPassword,
  validate('auth/reset-password', password.resetFormLocals),
  password.reset
);

module.exports = router;
