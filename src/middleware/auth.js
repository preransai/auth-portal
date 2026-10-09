const User = require('../models/User');

function clearAuth(session) {
  delete session.userId;
  delete session.authVersion;
}

// Runs on every request. Looking the user up each time (one indexed read)
// means a deactivated account or a password change takes effect on the very
// next request instead of whenever the cookie happens to expire.
async function loadUser(req, res, next) {
  res.locals.currentUser = null;
  const { userId, authVersion } = req.session;
  if (!userId) return next();

  const user = await User.findById(userId);
  if (!user || !user.isActive || user.sessionVersion !== authVersion) {
    clearAuth(req.session);
    return next();
  }

  req.user = user;
  res.locals.currentUser = user;
  next();
}

function requireAuth(req, res, next) {
  if (req.user) return next();
  if (req.method === 'GET') req.session.returnTo = req.originalUrl;
  req.flash('info', 'Please sign in to continue.');
  res.redirect('/login');
}

function requireGuest(req, res, next) {
  if (req.user) return res.redirect('/dashboard');
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  const err = new Error("You don't have permission to view this page.");
  err.status = 403;
  next(err);
}

module.exports = { loadUser, requireAuth, requireGuest, requireAdmin };
