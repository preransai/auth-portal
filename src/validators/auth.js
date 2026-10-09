const { body } = require('express-validator');
const User = require('../models/User');
const { emailField, nameField, passwordPolicy, confirmField, requiredPassword } = require('./rules');

const register = [
  nameField('name'),
  emailField('email')
    .bail()
    .custom(async (email) => {
      if (await User.exists({ email })) {
        throw new Error('An account with this email already exists. Try signing in instead.');
      }
      return true;
    }),
  passwordPolicy('password', (req) => req.body.email),
  confirmField('confirmPassword', 'password'),
  body('terms').equals('on').withMessage('Please accept the terms to continue.')
];

// Sign-in deliberately doesn't run the password policy: older accounts or
// seeded users shouldn't get policy hints from the login form.
const login = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Enter your email address.')
    .bail()
    .isLength({ max: 254 })
    .withMessage('That email address is too long.')
    .toLowerCase(),
  requiredPassword('password')
];

const emailOnly = [emailField('email')];

const resetPassword = [
  passwordPolicy('password', (req) => req.resetUser?.email),
  confirmField('confirmPassword', 'password')
];

module.exports = { register, login, emailOnly, resetPassword };
