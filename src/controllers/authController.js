const bcrypt = require('bcrypt');
const config = require('../config');
const User = require('../models/User');
const { createToken, consumeToken } = require('../services/tokens');
const { sendVerificationEmail, sendAccountLockedEmail } = require('../services/emails');
const { recordLoginAttempt } = require('../services/activity');
const { safeValues } = require('../middleware/validate');
const { startUserSession, endUserSession, saveSession, safeReturnPath } = require('../utils/session');

const GENERIC_LOGIN_ERROR = 'Invalid email or password.';
const VERIFY_TTL = config.security.verifyTokenHours * 60 * 60 * 1000;

// When the email doesn't exist we still run one bcrypt comparison against
// this hash. Without it, "unknown email" answers in ~1 ms and "wrong
// password" in ~250 ms, and the difference tells an attacker which emails
// have accounts.
let dummyHash;
async function getDummyHash() {
  dummyHash = dummyHash || (await bcrypt.hash('placeholder-password', config.security.bcryptRounds));
  return dummyHash;
}

function showRegister(req, res) {
  res.render('auth/register', { values: {}, errors: {} });
}

async function register(req, res) {
  const { name, email, password } = req.body;

  let user;
  try {
    user = await User.create({ name, email, password });
  } catch (err) {
    // Two sign-ups racing past the validator's duplicate check
    if (err.code !== 11000) throw err;
    return res.status(422).render('auth/register', {
      values: safeValues(req.body),
      errors: { email: 'An account with this email already exists. Try signing in instead.' }
    });
  }

  const token = await createToken(user._id, 'verify-email', VERIFY_TTL);
  await sendVerificationEmail(user, token);

  req.session.pendingEmail = user.email;
  res.redirect('/verify-email/sent');
}

function showVerificationSent(req, res) {
  const email = req.session.pendingEmail;
  if (!email) return res.redirect('/login');
  res.render('auth/verify-sent', { email });
}

async function verifyEmail(req, res) {
  const token = await consumeToken(req.params.token, 'verify-email');
  const user = token && (await User.findById(token.user));
  if (!user) {
    return res.status(400).render('auth/verify-result', { verified: false });
  }

  if (!user.isVerified) {
    user.isVerified = true;
    user.verifiedAt = new Date();
    await user.save();
  }
  delete req.session.pendingEmail;
  res.render('auth/verify-result', { verified: true, email: user.email });
}

function showResend(req, res) {
  res.render('auth/resend-verification', { values: { email: req.query.email || '' }, errors: {} });
}

async function resendVerification(req, res) {
  const { email } = req.body;
  const user = await User.findOne({ email, isVerified: false, isActive: true });
  if (user) {
    const token = await createToken(user._id, 'verify-email', VERIFY_TTL);
    await sendVerificationEmail(user, token);
  }

  // Same page either way, so this form can't be used to find out which
  // addresses are registered.
  res.render('auth/resend-verification', { values: { email }, errors: {}, sent: true });
}

function showLogin(req, res) {
  res.render('auth/login', { values: {}, errors: {} });
}

function loginError(res, values, formError, extra = {}) {
  return res.status(401).render('auth/login', { values, errors: {}, formError, ...extra });
}

async function login(req, res) {
  const { email, password } = req.body;
  const remember = req.body.remember === 'on';
  const values = { email, remember: req.body.remember };

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    await bcrypt.compare(password, await getDummyHash());
    await recordLoginAttempt(req, { email, reason: 'unknown-email' });
    return loginError(res, values, GENERIC_LOGIN_ERROR);
  }

  const passwordOk = await user.comparePassword(password);

  // The specific reasons below are only revealed to someone who has just
  // proved they know the password. Everyone else gets the generic message,
  // so the form never confirms whether an account exists.
  if (user.isLocked) {
    await recordLoginAttempt(req, { user, email, reason: 'locked' });
    if (!passwordOk) return loginError(res, values, GENERIC_LOGIN_ERROR);
    const minutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return loginError(
      res,
      values,
      `This account is locked after too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`,
      { showResetLink: true }
    );
  }

  if (!passwordOk) {
    const justLocked = await User.recordFailedLogin(user._id);
    if (justLocked) await sendAccountLockedEmail(user);
    await recordLoginAttempt(req, { user, email, reason: 'bad-password' });
    return loginError(res, values, GENERIC_LOGIN_ERROR);
  }

  if (!user.isActive) {
    await recordLoginAttempt(req, { user, email, reason: 'inactive' });
    return loginError(res, values, 'This account has been deactivated. Contact an administrator if you think this is a mistake.');
  }

  if (!user.isVerified) {
    await recordLoginAttempt(req, { user, email, reason: 'unverified' });
    return loginError(res, values, 'Please verify your email address before signing in.', {
      showResendLink: true
    });
  }

  user.clearLock();
  user.lastLoginAt = new Date();
  user.lastLoginIp = req.ip;
  await user.save();
  await recordLoginAttempt(req, { user, email, reason: 'ok' });

  const returnTo = safeReturnPath(req.session.returnTo);
  await startUserSession(req, user, { remember });
  req.flash('success', `You're signed in, ${user.firstName}.`);
  await saveSession(req);
  res.redirect(returnTo || '/dashboard');
}

async function logout(req, res) {
  await endUserSession(req);
  req.flash('success', 'You have been signed out.');
  await saveSession(req);
  res.redirect('/login');
}

module.exports = {
  showRegister,
  register,
  showVerificationSent,
  verifyEmail,
  showResend,
  resendVerification,
  showLogin,
  login,
  logout
};
