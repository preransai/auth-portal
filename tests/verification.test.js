const Token = require('../src/models/Token');
const User = require('../src/models/User');
const { hashToken } = require('../src/services/tokens');
const { useTestApp } = require('./helpers/setup');
const { newAgent, postForm, lastEmailTo, tokenFromEmail, login, pageText } = require('./helpers/http');

const ctx = useTestApp();

async function registerPriya(agent = newAgent(ctx.app)) {
  await postForm(agent, '/register', {
    name: 'Priya Raman',
    email: 'priya@example.com',
    password: 'Garden#Lamp42',
    confirmPassword: 'Garden#Lamp42',
    terms: 'on'
  });
  return tokenFromEmail(lastEmailTo('priya@example.com'));
}

describe('email verification', () => {
  test('stores only a SHA-256 hash of the token', async () => {
    const raw = await registerPriya();
    const stored = await Token.findOne({ type: 'verify-email' });
    expect(stored.tokenHash).not.toBe(raw);
    expect(stored.tokenHash).toBe(hashToken(raw));
    expect(await Token.exists({ tokenHash: raw })).toBeNull();
  });

  test('blocks sign-in until the email is verified', async () => {
    await registerPriya();
    const res = await login(newAgent(ctx.app), { email: 'priya@example.com', password: 'Garden#Lamp42' });
    expect(res.status).toBe(401);
    expect(res.text).toContain('Please verify your email address before signing in.');
  });

  test('a valid link verifies the account and allows sign-in', async () => {
    const raw = await registerPriya();
    const res = await newAgent(ctx.app).get(`/verify-email/${raw}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Email verified');

    const user = await User.findOne({ email: 'priya@example.com' });
    expect(user.isVerified).toBe(true);
    expect(user.verifiedAt).toBeInstanceOf(Date);

    const loginRes = await login(newAgent(ctx.app), { email: 'priya@example.com', password: 'Garden#Lamp42' });
    expect(loginRes.status).toBe(302);
    expect(loginRes.headers.location).toBe('/dashboard');
  });

  test('a link can only be used once', async () => {
    const raw = await registerPriya();
    await newAgent(ctx.app).get(`/verify-email/${raw}`);
    const second = await newAgent(ctx.app).get(`/verify-email/${raw}`);
    expect(second.status).toBe(400);
    expect(pageText(second)).toContain("This link doesn't work");
  });

  test('an expired link is rejected', async () => {
    const raw = await registerPriya();
    await Token.updateOne({ tokenHash: hashToken(raw) }, { expiresAt: new Date(Date.now() - 1000) });

    const res = await newAgent(ctx.app).get(`/verify-email/${raw}`);
    expect(res.status).toBe(400);
    expect((await User.findOne({ email: 'priya@example.com' })).isVerified).toBe(false);
  });

  test('a made-up token is rejected', async () => {
    const res = await newAgent(ctx.app).get(`/verify-email/${'a'.repeat(64)}`);
    expect(res.status).toBe(400);
  });

  test('resending invalidates the previous link', async () => {
    const first = await registerPriya();
    await postForm(newAgent(ctx.app), '/verify-email/resend', { email: 'priya@example.com' });
    const second = tokenFromEmail(lastEmailTo('priya@example.com'));
    expect(second).not.toBe(first);

    expect((await newAgent(ctx.app).get(`/verify-email/${first}`)).status).toBe(400);
    expect((await newAgent(ctx.app).get(`/verify-email/${second}`)).status).toBe(200);
  });

  test('resend gives the same answer for unknown emails', async () => {
    await registerPriya();
    const agent = newAgent(ctx.app);
    const known = await postForm(agent, '/verify-email/resend', { email: 'priya@example.com' });
    const unknown = await postForm(agent, '/verify-email/resend', { email: 'nobody@example.com' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    const strip = (res) => res.text.replace(/priya@example\.com|nobody@example\.com/g, 'EMAIL');
    expect(strip(unknown)).toBe(strip(known));
    expect(lastEmailTo('nobody@example.com')).toBeUndefined();
  });
});
