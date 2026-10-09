const { validationResult } = require('express-validator');

const SECRET_FIELDS = /password|_csrf/i;

// Re-renders the form with one message per field. Whatever the user typed is
// sent back so they don't have to retype it - except passwords, which are
// never written into HTML.
function safeValues(body = {}) {
  return Object.fromEntries(Object.entries(body).filter(([key]) => !SECRET_FIELDS.test(key)));
}

function validate(view, extraLocals = () => ({})) {
  return async (req, res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const errors = Object.fromEntries(
      Object.entries(result.mapped()).map(([field, error]) => [field, error.msg])
    );

    res.status(422).render(view, {
      values: safeValues(req.body),
      errors,
      ...(await extraLocals(req, res))
    });
  };
}

module.exports = { validate, safeValues };
