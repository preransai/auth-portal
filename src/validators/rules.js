const { body } = require('express-validator');

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;

const emailField = (field = 'email') =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage('Enter your email address.')
    .bail()
    .isLength({ max: 254 })
    .withMessage('That email address is too long.')
    .bail()
    .isEmail()
    .withMessage('Enter a valid email address, like name@example.com.')
    .bail()
    .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false });

const nameField = (field = 'name') =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage('Enter your full name.')
    .bail()
    .isLength({ min: 2, max: 60 })
    .withMessage('Name should be between 2 and 60 characters.')
    .bail()
    .matches(NAME_PATTERN)
    .withMessage('Use letters, spaces, apostrophes, dots or hyphens only.');

// "priya.raman@..." gives ["priya.raman", "priya", "raman"]. Pieces shorter
// than 3 characters are ignored, otherwise "a.k@..." would forbid every "a".
function emailNameParts(email) {
  const local = String(email || '')
    .split('@')[0]
    .toLowerCase();
  return [local, ...local.split(/[._+-]/)].filter((part) => part.length >= 3);
}

// Same rules as the live checklist in public/js/password-tools.js. The client
// side is only a convenience; this is the check that counts.
// `getEmail` lets the same policy work on sign-up (email is in the form) and
// on reset/change password (email comes from the account).
const passwordPolicy = (field, getEmail) =>
  body(field)
    .isLength({ min: 8, max: 64 })
    .withMessage('Password must be 8 to 64 characters long.')
    .bail()
    .matches(/[a-z]/)
    .withMessage('Add at least one lowercase letter.')
    .bail()
    .matches(/[A-Z]/)
    .withMessage('Add at least one uppercase letter.')
    .bail()
    .matches(/\d/)
    .withMessage('Add at least one number.')
    .bail()
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Add at least one symbol, like ! @ # or $.')
    .bail()
    .custom((value, { req }) => {
      const lower = value.toLowerCase();
      if (emailNameParts(getEmail(req)).some((part) => lower.includes(part))) {
        throw new Error("Password can't contain the first part of your email address.");
      }
      return true;
    });

const confirmField = (field, matches) =>
  body(field)
    .notEmpty()
    .withMessage('Please confirm your password.')
    .bail()
    .custom((value, { req }) => {
      if (value !== req.body[matches]) throw new Error("Passwords don't match.");
      return true;
    });

const requiredPassword = (field, message = 'Enter your password.') =>
  body(field).notEmpty().withMessage(message).bail().isLength({ max: 128 }).withMessage('That password is too long.');

module.exports = { emailField, nameField, passwordPolicy, confirmField, requiredPassword };
