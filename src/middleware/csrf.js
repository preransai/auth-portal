const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function tokensMatch(sent, expected) {
  const a = Buffer.from(String(sent));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Synchronizer token pattern: one random token per session, rendered into
// every form and checked on every state-changing request. SameSite=Lax on
// the cookie already stops most cross-site POSTs; this covers the rest
// (older browsers, same-site subdomains, GET-to-POST tricks).
function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (SAFE_METHODS.has(req.method)) return next();

  const sent = req.body?._csrf || req.get('x-csrf-token');
  if (sent && tokensMatch(sent, req.session.csrfToken)) return next();

  const err = new Error('The form you submitted has expired or was not sent from this site.');
  err.status = 403;
  err.code = 'EBADCSRFTOKEN';
  next(err);
}

module.exports = csrfProtection;
