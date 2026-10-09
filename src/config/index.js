require('dotenv').config({ quiet: true });

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';
const port = Number(process.env.PORT) || 3000;

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

// In production a missing secret or database is a deployment mistake, so we
// fail at boot instead of quietly falling back to something insecure.
if (isProd) {
  const missing = ['SESSION_SECRET', 'MONGODB_URI', 'APP_URL', 'SMTP_HOST'].filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing environment variables for production: ${missing.join(', ')}`);
  }
}

module.exports = {
  env,
  isProd,
  isTest,
  port,
  appName: process.env.APP_NAME || 'Auth Portal',
  appUrl: (process.env.APP_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  mongoUri: process.env.MONGODB_URI || '',
  trustProxy: toInt(process.env.TRUST_PROXY, isProd ? 1 : 0),

  session: {
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    rememberMeDays: 30
  },

  security: {
    // Cost 12 is roughly 250 ms per hash on a laptop, which is the point in
    // real use but would make the test suite crawl, so tests use the minimum.
    bcryptRounds: isTest ? 4 : 12,
    maxFailedLogins: 5,
    lockMinutes: 15,
    verifyTokenHours: 24,
    resetTokenMinutes: 30,
    loginRateLimit: toInt(process.env.LOGIN_RATE_LIMIT, 20),
    emailRateLimit: toInt(process.env.EMAIL_RATE_LIMIT, 5),
    rateWindowMinutes: 15
  },

  mail: {
    from: process.env.MAIL_FROM || 'Auth Portal <no-reply@example.com>',
    smtp: process.env.SMTP_HOST
      ? {
          host: process.env.SMTP_HOST,
          port: toInt(process.env.SMTP_PORT, 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined
        }
      : null,
    devMailbox: !isProd
  }
};
