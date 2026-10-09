const config = require('../config');

const call = (req, method) =>
  new Promise((resolve, reject) => {
    req.session[method]((err) => (err ? reject(err) : resolve()));
  });

// A fresh session id at sign-in means an id planted in the victim's browser
// before they logged in (session fixation) is worthless afterwards.
async function startUserSession(req, user, { remember = false } = {}) {
  await call(req, 'regenerate');
  req.session.userId = user.id;
  req.session.authVersion = user.sessionVersion;
  if (remember) {
    req.session.cookie.maxAge = config.session.rememberMeDays * 24 * 60 * 60 * 1000;
  }
}

// regenerate() destroys the old session in the store and hands us an empty
// one, which is still useful for showing a "signed out" message.
const endUserSession = (req) => call(req, 'regenerate');

const saveSession = (req) => call(req, 'save');

function safeReturnPath(path) {
  if (typeof path !== 'string') return null;
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : null;
}

module.exports = { startUserSession, endUserSession, saveSession, safeReturnPath };
