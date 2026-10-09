const config = require('../config');

const TITLES = {
  400: 'Bad request',
  403: 'Access denied',
  404: 'Page not found',
  413: 'Request too large',
  429: 'Slow down',
  500: 'Something went wrong'
};

function notFound(req, res, next) {
  const err = new Error("We couldn't find the page you were looking for.");
  err.status = 404;
  next(err);
}

function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  if (status < 400 || status > 599) status = 500;

  if (status >= 500) console.error(err);
  if (res.headersSent) return next(err);

  // Body-parser errors carry an `expose` flag; anything else that blew up
  // with a 500 might contain internals, so its message stays private.
  let message = err.message;
  if (status >= 500 && !err.expose) message = 'An unexpected error occurred. Please try again later.';
  if (status === 413) message = 'The form you submitted was too large.';
  if (err.code === 'EBADCSRFTOKEN') {
    message = 'This form expired or was submitted from somewhere else. Go back, refresh the page and try again.';
  }

  res.status(status);
  if (!req.accepts('html')) return res.json({ error: message });

  res.render('errors/error', {
    title: TITLES[status] || 'Error',
    status,
    message,
    stack: !config.isProd && status >= 500 ? err.stack : null
  });
}

module.exports = { notFound, errorHandler };
