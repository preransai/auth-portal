const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['verify-email', 'reset-password'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// MongoDB's TTL monitor clears expired tokens on its own (roughly once a
// minute). Lookups still check expiresAt, so a token is never accepted in
// the gap before it is removed.
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Token', tokenSchema);
