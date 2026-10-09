const config = require('../config');
const User = require('../models/User');
const { createToken, findToken, consumeToken } = require('../services/tokens');
const { sendPasswordResetEmail, sendPasswordChangedEmail } = require('../services/emails');

const RESET_TTL = config.security.resetTokenMinutes * 60 * 1000;

function showForgot(req, res) {
  res.render('auth/forgot-password', { values: {}, errors: {} });
}

async function forgot(req, res) {
  const { email } = req.body;
  const user = await User.findOne({ email, isActive: true });
  if (user) {
    const token = await createToken(user._id, 'reset-password', RESET_TTL);
    await sendPasswordResetEmail(user, token);
  }

  // Identical response whether or not the account exists.
  res.render('auth/forgot-password', { values: { email }, errors: {}, sent: true });
}

async function loadResetToken(req, res, next) {
  const token = await findToken(req.params.token, 'reset-password');
  const user = token && (await User.findById(token.user));
  if (!user || !user.isActive) {
    return res.status(400).render('auth/reset-password', { invalid: true, values: {}, errors: {} });
  }
  req.resetUser = user;
  next();
}

function showReset(req, res) {
  res.render('auth/reset-password', { token: req.params.token, email: req.resetUser.email, values: {}, errors: {} });
}

async function reset(req, res) {
  // Consumed only after validation passed, so a typo in the new password
  // doesn't burn the link.
  const token = await consumeToken(req.params.token, 'reset-password');
  if (!token) {
    return res.status(400).render('auth/reset-password', { invalid: true, values: {}, errors: {} });
  }

  const user = req.resetUser;
  user.password = req.body.password;
  user.clearLock();
  // The link arrived in their inbox, which proves they own the address.
  if (!user.isVerified) {
    user.isVerified = true;
    user.verifiedAt = new Date();
  }
  await user.save();
  await sendPasswordChangedEmail(user);

  req.flash('success', 'Your password has been reset. Sign in with your new password.');
  res.redirect('/login');
}

const resetFormLocals = (req) => ({ token: req.params.token, email: req.resetUser.email });

module.exports = { showForgot, forgot, loadResetToken, showReset, reset, resetFormLocals };
