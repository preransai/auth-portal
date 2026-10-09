const { body } = require('express-validator');
const { nameField, passwordPolicy, confirmField, requiredPassword } = require('./rules');

const profile = [nameField('name')];

const changePassword = [
  requiredPassword('currentPassword', 'Enter your current password.'),
  passwordPolicy('newPassword', (req) => req.user.email).custom((value, { req }) => {
    if (value === req.body.currentPassword) {
      throw new Error('Choose a password that is different from your current one.');
    }
    return true;
  }),
  confirmField('confirmPassword', 'newPassword')
];

const deleteAccount = [
  requiredPassword('deletePassword', 'Enter your password to confirm.'),
  body('confirmText').trim().equals('DELETE').withMessage('Type DELETE to confirm.')
];

module.exports = { profile, changePassword, deleteAccount };
