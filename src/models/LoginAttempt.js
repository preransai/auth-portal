const mongoose = require('mongoose');

const loginAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: { type: String, required: true, lowercase: true, trim: true },
    success: { type: Boolean, required: true },
    reason: {
      type: String,
      enum: ['ok', 'bad-password', 'unknown-email', 'locked', 'unverified', 'inactive'],
      required: true
    },
    ip: String,
    userAgent: { type: String, maxlength: 512 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

loginAttemptSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);
