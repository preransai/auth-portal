// Every field in this app is a plain string. Anything else in the body or
// query string - an object like { "$gt": "" } or a repeated key that the
// parser turned into an array - is either a bug or an injection attempt, so
// it is rejected before it can reach a validator or a database query.
function hasOnlyStrings(source) {
  if (!source) return true;
  return Object.values(source).every((value) => typeof value === 'string');
}

function rejectNonStringInput(req, res, next) {
  if (hasOnlyStrings(req.body) && hasOnlyStrings(req.query)) return next();
  const err = new Error('The request contained unexpected data.');
  err.status = 400;
  next(err);
}

module.exports = rejectNonStringInput;
