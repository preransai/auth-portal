const Token = require('../src/models/Token');
const User = require('../src/models/User');
const { hashToken } = require('../src/services/tokens');
const { useTestApp } = require('./helpers/setup');
const {
  newAgent,
  createUser,
  login,
  postForm,
  lastEmailTo,
  tokenFromEmail,
  pageText,
  PASSWORD
} = require('./helpers/http');

const ctx = useTestApp();
const NEW_PASSWORD = 'Brand#New2026x';

async function requestReset(email = 'test.user@example.com') {
  await postForm(newAgent(ctx.app), '/forgot-password', { email });
  return tokenFromEmail(lastEmailTo(email));
}

// The CSRF token comes from another page because a dead link renders no form.
function resetWith(token, password = NEW_PASSWORD, confirmPassword = password) {
  return postForm(newAgent(ctx.app), `/reset-password/${token}`, { password, confirmPassword }, '/forgot-password');
}

describe('forgot / reset password', () => {
  test('gives an identical response whether or not the account exists', async () => {
    await createUser();
    const agent = newAgent(ctx.app);
    const known = await postForm(agent, '/forgot-password', { email: 'test.user@example.com' });
    const unknown = await postForm(agent, '/forgot-password', { email: 'ghost@example.com' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    const strip = (res) => res.text.replace(/test\.user@example\.com|ghost@example\.com/g, 'EMAIL');
    expect(strip(unknown)).toBe(strip(known));

    expect(lastEmailTo('test.user@example.com').subject).toBe('Reset your password');
    expect(lastEmailTo('ghost@example.com')).toBeUndefined();
  });

  test('stores a hashed token that expires in 30 minutes', async () => {
    await createUser();
    const raw = await requestReset();
    const token = await Token.findOne({ type: 'reset-password' });
    expect(token.tokenHash).toBe(hashToken(raw));
    const minutes = (token.expiresAt - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(29);
    expect(minutes).toBeLessThanOrEqual(30);
  });

  test('resets the password and sends a confirmation email', async () => {
    await createUser();
    const raw = await requestReset();

    const form = await newAgent(ctx.app).get(`/reset-password/${raw}`);
    expect(form.status).toBe(200);
    expect(form.text).toContain('Choose a new password');

    const res = await resetWith(raw);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');

    expect((await login(newAgent(ctx.app))).status).toBe(401);
    expect((await login(newAgent(ctx.app), { password: NEW_PASSWORD })).status).toBe(302);
    expect(lastEmailTo('test.user@example.com').subject).toBe('Your password was changed');
  });

  test('applies the same password policy as sign-up', async () => {
    await createUser();
    const raw = await requestReset();

    const weak = await resetWith(raw, 'weakpass');
    expect(weak.status).toBe(422);
    expect(weak.text).toContain('Add at least one uppercase letter.');

    const withEmail = await resetWith(raw, 'Test.User#99');
    expect(pageText(withEmail)).toContain("Password can't contain the first part of your email address.");

    // Validation errors must not burn the link.
    expect((await resetWith(raw)).status).toBe(302);
  });

  test('a reset link works only once', async () => {
    await createUser();
    const raw = await requestReset();
    await resetWith(raw);

    const again = await resetWith(raw, 'Another#Pass77');
    expect(again.status).toBe(400);
    expect(pageText(again)).toContain("This reset link doesn't work");
    expect((await login(newAgent(ctx.app), { password: NEW_PASSWORD })).status).toBe(302);
  });

  test('an expired link is rejected', async () => {
    await createUser();
    const raw = await requestReset();
    await Token.updateOne({ tokenHash: hashToken(raw) }, { expiresAt: new Date(Date.now() - 1000) });

    expect((await newAgent(ctx.app).get(`/reset-password/${raw}`)).status).toBe(400);
    expect((await resetWith(raw)).status).toBe(400);
    expect((await login(newAgent(ctx.app), { password: PASSWORD })).status).toBe(302);
  });

  test('signs out every existing session of that user', async () => {
    await createUser();
    const laptop = newAgent(ctx.app);
    const phone = newAgent(ctx.app);
    await login(laptop);
    await login(phone);
    expect((await laptop.get('/dashboard')).status).toBe(200);

    await resetWith(await requestReset());

    for (const agent of [laptop, phone]) {
      const res = await agent.get('/dashboard');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/login');
    }
  });

  test('also clears a lockout and verifies the email', async () => {
    const user = await createUser({ isVerified: false, lockUntil: new Date(Date.now() + 600000) });
    await resetWith(await requestReset());
    const fresh = await User.findById(user._id);
    expect(fresh.isLocked).toBe(false);
    expect(fresh.isVerified).toBe(true);
  });
});
