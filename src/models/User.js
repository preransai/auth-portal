const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const config = require('../config');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    verifiedAt: Date,
    isActive: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    // Bumped whenever the password changes or an admin deactivates the
    // account. Each session remembers the value it was created with, so
    // bumping it signs out every other session without touching the store.
    sessionVersion: { type: Number, default: 0 },
    passwordChangedAt: Date,
    lastLoginAt: Date,
    lastLoginIp: String
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      }
    }
  }
);

userSchema.virtual('isLocked').get(function () {
  return Boolean(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.virtual('firstName').get(function () {
  return this.name.split(' ')[0];
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, config.security.bcryptRounds);
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
    this.sessionVersion += 1;
  }
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// $inc instead of read-modify-save: with a plain save, ten parallel wrong
// guesses would all read 0 and write 1, and the lock would never trigger.
// Returns true only for the request that actually tripped the lock.
userSchema.statics.recordFailedLogin = async function (userId) {
  const { maxFailedLogins, lockMinutes } = config.security;
  const user = await this.findByIdAndUpdate(
    userId,
    { $inc: { failedLoginAttempts: 1 } },
    { returnDocument: 'after' }
  );
  if (!user || user.failedLoginAttempts < maxFailedLogins) return false;

  await this.updateOne(
    { _id: userId },
    { lockUntil: new Date(Date.now() + lockMinutes * 60 * 1000), failedLoginAttempts: 0 }
  );
  return user.failedLoginAttempts === maxFailedLogins;
};

userSchema.methods.clearLock = function () {
  this.failedLoginAttempts = 0;
  this.lockUntil = undefined;
};

module.exports = mongoose.model('User', userSchema);
