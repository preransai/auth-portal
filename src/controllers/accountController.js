const User = require('../models/User');
const Token = require('../models/Token');
const LoginAttempt = require('../models/LoginAttempt');
const { recentActivity, previousSignIn } = require('../services/activity');
const { sendPasswordChangedEmail } = require('../services/emails');
const { endUserSession, saveSession } = require('../utils/session');

async function dashboard(req, res) {
  const [activity, lastSignIn] = await Promise.all([
    recentActivity(req.user._id),
    previousSignIn(req.user._id)
  ]);
  res.render('account/dashboard', {
    activity,
    lastSignIn,
    failedCount: activity.filter((attempt) => !attempt.success).length,
    sessionExpires: req.session.cookie.expires || null
  });
}

function settingsLocals(req) {
  return { values: { name: req.user.name } };
}

function showSettings(req, res) {
  res.render('account/settings', { ...settingsLocals(req), errors: {} });
}

async function updateProfile(req, res) {
  req.user.name = req.body.name;
  await req.user.save();
  req.flash('success', 'Your name has been updated.');
  res.redirect('/account');
}

function settingsError(req, res, errors) {
  return res.status(422).render('account/settings', { ...settingsLocals(req), errors });
}

async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) {
    return settingsError(req, res, { currentPassword: "That isn't your current password." });
  }

  user.password = req.body.newPassword;
  await user.save();

  // The save bumped sessionVersion, which signs out every other session.
  // This one is kept alive by moving it to the new version.
  req.session.authVersion = user.sessionVersion;
  await sendPasswordChangedEmail(user);

  req.flash('success', 'Password changed. Any other devices have been signed out.');
  res.redirect('/account');
}

async function deleteAccount(req, res) {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.deletePassword))) {
    return settingsError(req, res, { deletePassword: "That password isn't correct." });
  }

  if (user.role === 'admin' && (await User.countDocuments({ role: 'admin' })) === 1) {
    return settingsError(req, res, {
      deletePassword: "You're the only admin. Make someone else an admin before deleting your account."
    });
  }

  await Promise.all([
    Token.deleteMany({ user: user._id }),
    LoginAttempt.deleteMany({ user: user._id }),
    User.deleteOne({ _id: user._id })
  ]);

  await endUserSession(req);
  req.flash('success', 'Your account and its data have been deleted.');
  await saveSession(req);
  res.redirect('/login');
}

module.exports = { dashboard, showSettings, updateProfile, changePassword, deleteAccount, settingsLocals };
