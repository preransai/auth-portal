const LoginAttempt = require('../models/LoginAttempt');
const { describeUserAgent, deviceKind } = require('../utils/userAgent');

const REASON_LABELS = {
  ok: 'Signed in',
  'bad-password': 'Wrong password',
  'unknown-email': 'Unknown email',
  locked: 'Blocked: account locked',
  unverified: 'Blocked: email not verified',
  inactive: 'Blocked: account deactivated'
};

function recordLoginAttempt(req, { user, email, reason }) {
  return LoginAttempt.create({
    user: user?._id,
    email,
    success: reason === 'ok',
    reason,
    ip: req.ip,
    userAgent: (req.get('user-agent') || '').slice(0, 512)
  });
}

async function recentActivity(userId, limit = 10) {
  const attempts = await LoginAttempt.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).lean();
  return attempts.map((attempt) => ({
    ...attempt,
    label: REASON_LABELS[attempt.reason],
    device: describeUserAgent(attempt.userAgent),
    deviceKind: deviceKind(attempt.userAgent)
  }));
}

// The newest successful attempt is the session the user is in right now, so
// "last sign-in" on the dashboard is the one before it.
async function previousSignIn(userId) {
  const attempt = await LoginAttempt.findOne({ user: userId, success: true })
    .sort({ createdAt: -1 })
    .skip(1)
    .lean();
  return attempt && { ...attempt, device: describeUserAgent(attempt.userAgent) };
}

module.exports = { recordLoginAttempt, recentActivity, previousSignIn };
