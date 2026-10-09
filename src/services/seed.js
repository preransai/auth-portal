const config = require('../config');
const User = require('../models/User');

const DEMO_PASSWORD = 'Demo@12345';
const { lockMinutes } = config.security;

const DEMO_ACCOUNTS = {
  password: DEMO_PASSWORD,
  users: [
    { name: 'Ananya Iyer', email: 'admin@example.com', role: 'admin', note: 'admin' },
    { name: 'Aarav Sharma', email: 'aarav@example.com', note: 'verified user' },
    { name: 'Meera Krishnan', email: 'meera@example.com', note: 'verified user' },
    { name: 'Diya Patel', email: 'diya@example.com', isVerified: false, note: 'email not verified yet' },
    { name: 'Rohan Mehta', email: 'rohan@example.com', locked: true, note: 'locked out (15 min)' },
    { name: 'Kabir Singh', email: 'kabir@example.com', isActive: false, note: 'deactivated by admin' }
  ]
};

// Inserts the demo accounts that don't exist yet, so running it twice is
// harmless. Goes through the model (not insertMany) so the pre-save hook
// hashes each password exactly like a real sign-up.
async function seedDemoData() {
  const created = [];
  for (const { note, locked, ...account } of DEMO_ACCOUNTS.users) {
    if (await User.exists({ email: account.email })) continue;

    const user = new User({
      isVerified: true,
      ...account,
      password: DEMO_PASSWORD
    });
    if (user.isVerified) user.verifiedAt = new Date();
    if (locked) user.lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
    await user.save();
    created.push(user.email);
  }
  return created;
}

module.exports = { seedDemoData, DEMO_ACCOUNTS };
