const crypto = require('crypto');
const mongoose = require('mongoose');
const Token = require('../models/Token');

// The raw token only ever exists in the email we send. The database keeps a
// SHA-256 of it, so a leaked backup or a read-only injection can't be turned
// into working verification or reset links. A fast hash is fine here because
// the input is 32 random bytes, not something a person picked.
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function createToken(userId, type, ttlMs) {
  await Token.deleteMany({ user: userId, type });
  const raw = crypto.randomBytes(32).toString('hex');
  await Token.create({
    user: userId,
    type,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + ttlMs)
  });
  return raw;
}

function liveTokenFilter(raw, type) {
  if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) return null;
  return {
    tokenHash: hashToken(raw),
    type,
    expiresAt: mongoose.trusted({ $gt: new Date() })
  };
}

async function findToken(raw, type) {
  const filter = liveTokenFilter(raw, type);
  return filter ? Token.findOne(filter) : null;
}

// findOneAndDelete makes "use" atomic: two requests racing with the same
// link can't both succeed.
async function consumeToken(raw, type) {
  const filter = liveTokenFilter(raw, type);
  return filter ? Token.findOneAndDelete(filter) : null;
}

module.exports = { createToken, findToken, consumeToken, hashToken };
