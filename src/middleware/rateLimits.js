const { rateLimit } = require('express-rate-limit');
const config = require('../config');

const windowMs = config.security.rateWindowMinutes * 60 * 1000;

// The per-IP limit slows down credential stuffing across many accounts; the
// per-account lockout in the login controller handles a single targeted
// account. Each covers the other's blind spot.
const loginLimiter = rateLimit({
  windowMs,
  limit: config.security.loginRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).render('auth/login', {
      title: 'Sign in',
      values: { email: req.body.email || '' },
      errors: {},
      formError: 'Too many sign-in attempts from your network. Please wait a few minutes and try again.'
    });
  }
});

function emailLimiter(view, title) {
  return rateLimit({
    windowMs,
    limit: config.security.emailRateLimit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler(req, res) {
      res.status(429).render(view, {
        title,
        values: { email: req.body.email || '' },
        errors: {},
        formError: "You've requested a lot of emails recently. Please try again in a few minutes."
      });
    }
  });
}

const resendLimiter = emailLimiter('auth/resend-verification', 'Resend verification email');
const forgotLimiter = emailLimiter('auth/forgot-password', 'Forgot password');

module.exports = { loginLimiter, resendLimiter, forgotLimiter };
