process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.SMTP_HOST = '';
process.env.APP_URL = 'http://localhost:3000';

// Most suites make dozens of sign-in attempts from the same "IP", so the
// per-IP limits are raised here. rate-limit.test.js lowers them again.
process.env.LOGIN_RATE_LIMIT = '1000';
process.env.EMAIL_RATE_LIMIT = '1000';
