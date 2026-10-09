const config = require('../config');
const { sendMail } = require('./mail');

const url = (pathname) => `${config.appUrl}${pathname}`;

function sendVerificationEmail(user, token) {
  return sendMail({
    to: user.email,
    subject: 'Confirm your email address',
    content: {
      heading: `Welcome, ${user.firstName}`,
      paragraphs: [
        `Thanks for creating an account on ${config.appName}. Please confirm that this is your email address so you can sign in.`
      ],
      action: { label: 'Verify email address', url: url(`/verify-email/${token}`) },
      footnote: `This link expires in ${config.security.verifyTokenHours} hours and can only be used once. If you didn't sign up, you can ignore this email.`
    }
  });
}

function sendPasswordResetEmail(user, token) {
  return sendMail({
    to: user.email,
    subject: 'Reset your password',
    content: {
      heading: 'Reset your password',
      paragraphs: [
        `Hi ${user.firstName}, we received a request to reset the password for your account.`,
        'Use the button below to choose a new one.'
      ],
      action: { label: 'Choose a new password', url: url(`/reset-password/${token}`) },
      footnote: `This link expires in ${config.security.resetTokenMinutes} minutes. If you didn't ask for a reset, no action is needed and your password stays the same.`
    }
  });
}

function sendPasswordChangedEmail(user) {
  return sendMail({
    to: user.email,
    subject: 'Your password was changed',
    content: {
      heading: 'Your password was changed',
      paragraphs: [
        `Hi ${user.firstName}, the password for your ${config.appName} account was just changed and all other sessions were signed out.`,
        "If this was you, there's nothing else to do."
      ],
      action: { label: "This wasn't me", url: url('/forgot-password') },
      footnote: 'If you did not make this change, reset your password straight away.'
    }
  });
}

function sendAccountLockedEmail(user) {
  return sendMail({
    to: user.email,
    subject: 'Your account was temporarily locked',
    content: {
      heading: 'Too many failed sign-in attempts',
      paragraphs: [
        `Hi ${user.firstName}, we locked your account for ${config.security.lockMinutes} minutes after ${config.security.maxFailedLogins} wrong passwords in a row.`,
        "If that was you, wait a few minutes and try again. If it wasn't, someone may be guessing your password and it's a good idea to change it."
      ],
      action: { label: 'Reset password', url: url('/forgot-password') },
      footnote: 'The lock lifts automatically. An administrator can also unlock the account.'
    }
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountLockedEmail
};
