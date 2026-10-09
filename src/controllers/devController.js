const { getOutbox, findMessage, clearOutbox } = require('../services/mail');

function mailbox(req, res) {
  res.render('dev/mailbox', { messages: getOutbox() });
}

function showMessage(req, res, next) {
  const message = findMessage(req.params.id);
  if (!message) return next();
  res.render('dev/message', { message });
}

// Email HTML relies on inline styles, which the app-wide CSP blocks. This
// one response gets its own policy: inline styles allowed, no scripts at
// all, and it may only be framed by our own mailbox page.
function rawMessage(req, res, next) {
  const message = findMessage(req.params.id);
  if (!message) return next();
  res.set(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'; form-action 'none'"
  );
  // The sandboxed frame has an opaque origin, so this header only produces a
  // console warning there.
  res.removeHeader('Origin-Agent-Cluster');
  res.type('html').send(message.html.replace('<head>', '<head><base target="_top">'));
}

function clear(req, res) {
  clearOutbox();
  req.flash('success', 'Mailbox cleared.');
  res.redirect('/dev/mailbox');
}

module.exports = { mailbox, showMessage, rawMessage, clear };
